from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.attributes import flag_modified
import models
import schemas
from typing import Optional, List
from services import broadcast as broadcast_service
from services import giveaway_service
from services import user_service
from services import achievement_service
import datetime
import uuid

AVERAGE_REVIEW_TIME_MINUTES = 4

async def create_submission(db: AsyncSession, reviewer_id: int, user_id: int, track_url: str, track_title: str, archived_url: str, session_id: Optional[int] = None, batch_id: Optional[str] = None, sequence_order: int = 1, hook_start_time: Optional[int] = None, hook_end_time: Optional[int] = None, priority_value: int = 0, artist: Optional[str] = None, genre: Optional[str] = None, file_hash: Optional[str] = None, cover_art_url: Optional[str] = None, note: Optional[str] = None) -> models.Submission:
    # Check for existing flags (Spotlight/Bookmark) from previous submissions
    # We check by file_hash (if available) or track_url
    existing_flags_stmt = select(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.user_id == user_id,
        (models.Submission.bookmarked == True) | (models.Submission.spotlighted == True)
    )
    
    if file_hash:
        existing_flags_stmt = existing_flags_stmt.filter(models.Submission.file_hash == file_hash)
    else:
        existing_flags_stmt = existing_flags_stmt.filter(models.Submission.track_url == track_url)
        
    existing_flags_stmt = existing_flags_stmt.limit(1)
    existing_flags_result = await db.execute(existing_flags_stmt)
    existing_flagged_sub = existing_flags_result.scalars().first()
    
    is_bookmarked = False
    is_spotlighted = False
    
    if existing_flagged_sub:
        is_bookmarked = existing_flagged_sub.bookmarked
        is_spotlighted = existing_flagged_sub.spotlighted

    new_submission = models.Submission(
        reviewer_id=reviewer_id,
        user_id=user_id,
        track_url=track_url,
        track_title=track_title,
        artist=artist,
        genre=genre,
        archived_url=archived_url,
        status='pending',
        session_id=session_id,
        priority_value=priority_value,
        # Smart-Zone fields
        batch_id=batch_id,
        sequence_order=sequence_order,
        hook_start_time=hook_start_time,
        hook_end_time=hook_end_time,
        is_priority=priority_value > 0,
        file_hash=file_hash,
        bookmarked=is_bookmarked,
        spotlighted=is_spotlighted,
        cover_art_url=cover_art_url,
        notes=note
    )
    db.add(new_submission)

    # Award XP for submission
    await user_service.add_xp(db, user_id, 10) # Award 10 XP per submission

    # --- CATEGORY A ACHIEVEMENTS CHECK (Creation Time) ---
    # 1. Demo Tape (1st Submission)
    stmt_count = select(models.Submission).filter(models.Submission.user_id == user_id)
    count_res = await db.execute(stmt_count)
    sub_count = len(count_res.scalars().all()) + 1 # +1 for this one (not yet committed but added)

    await achievement_service.trigger_achievement(db, user_id, "SUBMISSION_COUNT", sub_count)
    if sub_count == 1:
         await achievement_service.trigger_achievement(db, user_id, "SUBMISSION_COUNT", specific_slug="demo_tape")

    # 2. Producer Tag
    if track_title and "(prod." in track_title.lower():
         await achievement_service.trigger_achievement(db, user_id, "METADATA_TAG", specific_slug="producer_tag")

    # 3. Collaborator
    if track_title and "feat." in track_title.lower():
         await achievement_service.trigger_achievement(db, user_id, "METADATA_TAG", specific_slug="collaborator")

    # 4. Link Types
    if "soundcloud.com" in track_url.lower():
        await achievement_service.trigger_achievement(db, user_id, "LINK_TYPE", specific_slug="soundcloud_rapper")
    elif "spotify.com" in track_url.lower() or "apple.com" in track_url.lower():
        await achievement_service.trigger_achievement(db, user_id, "LINK_TYPE", specific_slug="dsp_pro")

    # 5. Genre Bender (Unique Tags)
    # This requires checking history. We'll do a query.
    if genre:
        # Get all distinct genres for this user
        genre_stmt = select(models.Submission.genre).filter(models.Submission.user_id == user_id).distinct()
        genres = (await db.execute(genre_stmt)).scalars().all()
        # Add current if not present (since not committed yet)
        unique_genres = set([g for g in genres if g])
        unique_genres.add(genre)
        await achievement_service.trigger_achievement(db, user_id, "GENRE_COUNT", len(unique_genres))

    # Anti-Cannibalization: Paid Override
    # If this is a paid submission (priority > 0), extend the giveaway cooldown
    if priority_value > 0:
        # Extend by 5 minutes (or whatever rule)
        await giveaway_service.extend_cooldown(db, reviewer_id, minutes=5)

    await db.commit()

    # FIXED: Re-fetch the submission to eager-load the 'user' relationship for the API response
    stmt = select(models.Submission).options(joinedload(models.Submission.user)).filter(models.Submission.id == new_submission.id)
    result = await db.execute(stmt)
    loaded_submission = result.scalars().first()

    # Emit a queue update
    try:
        new_queue = await get_pending_queue(db, reviewer_id)
        # Apply Zipper Merge
        zipped_queue = apply_zipper_merge(new_queue)
        queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
        await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])
    except Exception as e:
        import logging
        logging.error(f"Failed to emit queue update: {e}")

    return loaded_submission

async def get_pending_queue(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status.in_(['pending', 'playing']),
            models.Submission.submitted_at.isnot(None),
            models.Submission.user_id.isnot(None)
        )
        .order_by(models.Submission.priority_value.desc(), models.Submission.submitted_at.asc())
    )
    return result.scalars().all()

def apply_zipper_merge(queue: List[models.Submission]) -> List[models.Submission]:
    """
    Interleaves Paid (Priority) and Free submissions using a 3:1 ratio.
    Pattern: Paid, Paid, Paid, Free, Paid...
    """
    priority_queue = [s for s in queue if s.priority_value > 0]
    free_queue = [s for s in queue if s.priority_value == 0]
    
    merged_queue = []
    
    while priority_queue or free_queue:
        # Add up to 3 priority tracks
        for _ in range(3):
            if priority_queue:
                merged_queue.append(priority_queue.pop(0))
        
        # Add 1 free track
        if free_queue:
            merged_queue.append(free_queue.pop(0))
            
        # If no priority tracks left, append remaining free tracks? 
        # Or if no free tracks left, append remaining priority?
        # The loop continues until both are empty.
        
    return merged_queue

async def set_queue_status(db: AsyncSession, reviewer_id: int, status: str):
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()
    if reviewer:
        reviewer.queue_status = status
        await db.commit()
        await db.refresh(reviewer)
    return reviewer

async def _update_reviewer_active_track(db: AsyncSession, reviewer_id: int, submission_id: Optional[int]):
    """Helper to update the reviewer's active track configuration."""
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()
    if reviewer:
        # Ensure configuration dict exists
        if not reviewer.configuration:
            reviewer.configuration = {}
        elif isinstance(reviewer.configuration, str):
            import json
            try:
                reviewer.configuration = json.loads(reviewer.configuration)
            except:
                reviewer.configuration = {}

        # Create a copy to trigger SQLAlchemy change detection (though flag_modified is safer)
        new_config = dict(reviewer.configuration)
        new_config['active_track_id'] = submission_id
        reviewer.configuration = new_config

        # Explicitly flag as modified to ensure persistence of JSON changes
        flag_modified(reviewer, "configuration")

        # We don't commit here, let the caller do it

async def advance_queue(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    # First, find any currently playing tracks and reset them to pending
    # This ensures we don't have multiple playing tracks
    active_result = await db.execute(
        select(models.Submission)
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'playing'
        )
    )
    active_tracks = active_result.scalars().all()
    for track in active_tracks:
        track.status = 'played' # Move to history so queue advances

    # Get the next submission (now that playing ones are pending, the "next" one is the top of pending)
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'pending'
        )
        .order_by(models.Submission.priority_value.desc(), models.Submission.submitted_at.asc())
        .limit(1)
    )
    submission = result.scalars().first()

    if submission:
        # Update status to playing so we can track the active submission in DB
        submission.status = 'playing'

        # Update reviewer config pointer
        await _update_reviewer_active_track(db, reviewer_id, submission.id)

        await db.commit()

        # Emit current track update so frontend knows what to play
        submission_schema = schemas.Submission.model_validate(submission)
        await broadcast_service.emit_current_track_update(reviewer_id, submission_schema.model_dump(mode='json'))

        # Emit queue update as well since status changed
        new_queue = await get_pending_queue(db, reviewer_id)
        zipped_queue = apply_zipper_merge(new_queue)
        queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
        await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])
    else:
        # Clear active track if queue is empty
        await _update_reviewer_active_track(db, reviewer_id, None)
        await db.commit()
        await broadcast_service.emit_current_track_update(reviewer_id, None)

    return submission

async def set_track_playing(db: AsyncSession, reviewer_id: int, submission_id: int) -> Optional[models.Submission]:
    # 1. Find and reset existing playing track (only if it was playing)
    active_result = await db.execute(
        select(models.Submission)
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'playing'
        )
    )
    active_tracks = active_result.scalars().all()
    for track in active_tracks:
        if track.id != submission_id:
            track.status = 'pending'

    # 2. Set new track to playing
    stmt = (
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id, models.Submission.reviewer_id == reviewer_id)
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()

    if not submission:
        return None

    # Always set status to playing when selected as active track
    submission.status = 'playing'

    # Update reviewer config pointer
    await _update_reviewer_active_track(db, reviewer_id, submission.id)

    await db.commit()
    await db.commit()
    
    # Re-fetch submission with user to ensure it's loaded after commit (which expires objects)
    stmt = (
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()

    # 3. Broadcast updates
    submission_schema = schemas.Submission.model_validate(submission)
    await broadcast_service.emit_current_track_update(reviewer_id, submission_schema.model_dump(mode='json'))

    new_queue = await get_pending_queue(db, reviewer_id)
    zipped_queue = apply_zipper_merge(new_queue)
    queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
    await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])

    return submission

async def return_active_to_queue(db: AsyncSession, reviewer_id: int):
    """
    Moves any 'playing' tracks back to 'pending' status without changing their position.
    Emits queue update and clears current track.
    """
    result = await db.execute(
        select(models.Submission)
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'playing'
        )
    )
    playing_tracks = result.scalars().all()
    
    if not playing_tracks:
        return

    for track in playing_tracks:
        track.status = 'pending'
        # Keep original timestamp
    
    await db.commit()

    # Emit updates
    new_queue = await get_pending_queue(db, reviewer_id)
    zipped_queue = apply_zipper_merge(new_queue)
    queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
    await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])
    
    await broadcast_service.emit_current_track_update(reviewer_id, None)

async def get_reviewer_by_user_id(db: AsyncSession, user_id: int) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
        .filter(models.Reviewer.user_id == user_id)
    )
    return _merge_reviewer_config(result.scalars().first())

async def get_reviewer_by_channel_id(db: AsyncSession, channel_id: str) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
        .filter(models.Reviewer.discord_channel_id == str(channel_id))
    )
    return _merge_reviewer_config(result.scalars().first())

async def get_reviewer_by_id(db: AsyncSession, reviewer_id: int) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
        .filter(models.Reviewer.id == reviewer_id)
    )
    return _merge_reviewer_config(result.scalars().first())

async def get_reviewer_by_tiktok_handle(db: AsyncSession, tiktok_handle: str) -> Optional[models.Reviewer]:
    # Case-insensitive search
    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
        .filter(func.lower(models.Reviewer.tiktok_handle) == tiktok_handle.lower())
    )
    return _merge_reviewer_config(result.scalars().first())

def _merge_reviewer_config(reviewer: Optional[models.Reviewer]) -> Optional[models.Reviewer]:
    """
    Merges the reviewer's configuration with default values.
    Ensures that even if configuration is None, defaults are provided for critical settings.
    """
    if not reviewer:
        return None

    default_tiers = [
        {"value": 3, "label": "⚡ Fast Pass", "color": "blue", "description": "Jump to Top 50%"},
        {"value": 10, "label": "🚀 Priority", "color": "purple", "description": "Jump to Top 10 (Skips ~20 songs)"},
        {"value": 25, "label": "👑 VIP Instant", "color": "red", "description": "Play Next (#1) - 2 Songs Back to Back"},
        {"value": 50, "label": "💎 Super VIP", "color": "gold", "description": "3 Songs Back to Back to Back"},
    ]
    
    default_goal = {
        "type": "LIKES",
        "target": 1000,
        "current": 0,
        "description": "Reach 1000 Likes for a Hot Seat Draw!"
    }

    if not reviewer.configuration:
        reviewer.configuration = {
            "priority_tiers": default_tiers, 
            "visible_free_limit": 20
        }
    
    # Ensure the configuration is a valid dict (though SQLAlchemy handles JSON decoding)
    if isinstance(reviewer.configuration, str):
        import json
        try:
            reviewer.configuration = json.loads(reviewer.configuration)
        except json.JSONDecodeError:
             reviewer.configuration = {
                 "priority_tiers": default_tiers, 
                 "visible_free_limit": 20
             }

    if "priority_tiers" not in reviewer.configuration:
         # If config exists but no tiers, merge defaults
        reviewer.configuration["priority_tiers"] = default_tiers
        
    # community_goal default removed as we use giveaway_settings now (handled in giveaway_service)

    if "visible_free_limit" not in reviewer.configuration:
        reviewer.configuration["visible_free_limit"] = 20

    return reviewer

async def update_reviewer_settings(db: AsyncSession, reviewer_id: int, settings_update: schemas.ReviewerSettingsUpdate) -> Optional[models.Reviewer]:
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()

    if not reviewer:
        return None

    update_data = settings_update.model_dump(exclude_unset=True)

    if "tiktok_handle" in update_data:
        reviewer.tiktok_handle = update_data["tiktok_handle"]
    if "discord_channel_id" in update_data:
        reviewer.discord_channel_id = update_data["discord_channel_id"]
    if "see_the_line_channel_id" in update_data:
        reviewer.see_the_line_channel_id = update_data["see_the_line_channel_id"]
    if "avatar_url" in update_data:
        reviewer.avatar_url = update_data["avatar_url"]
    if "bio" in update_data:
        reviewer.bio = update_data["bio"]
    if "community_goal_cooldown_minutes" in update_data:
        reviewer.community_goal_cooldown_minutes = update_data["community_goal_cooldown_minutes"]

    if "configuration" in update_data and update_data["configuration"] is not None:
        # If updating configuration, we should merge or replace.
        # Since the input is a full configuration object, we can replace the specific keys.
        # However, we need to convert Pydantic models to dicts for JSON storage
        new_config = update_data["configuration"]
        # Pydantic v2 model_dump handles recursive dict conversion
        # Pydantic v2 model_dump handles recursive dict conversion
        # If reviewer.configuration is None, init it
        raw_config = reviewer.configuration
        if isinstance(raw_config, str):
             import json
             try:
                 current_config = json.loads(raw_config)
             except:
                 current_config = {}
        else:
             # Create a copy to ensure SQLAlchemy detects the change
             current_config = dict(raw_config) if raw_config else {}

        # Update all fields present in new_config
        for key, value in new_config.items():
             current_config[key] = value

        reviewer.configuration = current_config
        # Explicitly flag as modified to ensure persistence of JSON changes
        flag_modified(reviewer, "configuration")

    if "economy_configs" in update_data and update_data["economy_configs"] is not None:
        new_configs = update_data["economy_configs"]
        # We need to update or create configs
        # First, get existing configs
        stmt = select(models.EconomyConfig).filter(models.EconomyConfig.reviewer_id == reviewer_id)
        result = await db.execute(stmt)
        existing_configs = result.scalars().all()
        existing_map = {c.event_name: c for c in existing_configs}

        for config_data in new_configs:
            event_name = config_data["event_name"]
            amount = config_data["coin_amount"]
            
            if event_name in existing_map:
                existing_map[event_name].coin_amount = amount
            else:
                new_config = models.EconomyConfig(
                    reviewer_id=reviewer_id,
                    event_name=event_name,
                    coin_amount=amount
                )
                db.add(new_config)

    await db.commit()
    await db.refresh(reviewer)

    # Re-fetch with user to return full object
    updated_reviewer = await get_reviewer_by_user_id(db, reviewer.user_id)
    
    # Emit settings update
    if updated_reviewer:
        # We need to serialize the reviewer object to dict/json
        # Using schemas.ReviewerProfile to validate and dump
        reviewer_schema = schemas.ReviewerProfile.model_validate(updated_reviewer)
        await broadcast_service.emit_reviewer_settings_update(reviewer_id, reviewer_schema.model_dump(mode='json'))

    return updated_reviewer

async def get_submissions_by_user(db: AsyncSession, user_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(
            joinedload(models.Submission.user),
            joinedload(models.Submission.reviewer).options(
                joinedload(models.Reviewer.user),
                selectinload(models.Reviewer.payment_configs),
                selectinload(models.Reviewer.economy_configs)
            )
        )
        .filter(models.Submission.user_id == user_id)
        .order_by(models.Submission.submitted_at.desc())
    )
    return result.scalars().all()

async def toggle_bookmark(db: AsyncSession, submission_id: int) -> Optional[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if submission:
        submission.bookmarked = not submission.bookmarked
        await db.commit()
        await db.refresh(submission)
    return submission

async def toggle_spotlight(db: AsyncSession, submission_id: int) -> Optional[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if submission:
        submission.spotlighted = not submission.spotlighted
        await db.commit()
        await db.refresh(submission)
    return submission

async def update_priority(db: AsyncSession, submission_id: int, priority_value: int) -> Optional[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if submission:
        submission.priority_value = priority_value
        # Also update is_priority flag for backward compatibility if needed, or just rely on value
        submission.is_priority = priority_value > 0
        await db.commit()
        await db.refresh(submission)
        
        # Emit queue update because order might change
        new_queue = await get_pending_queue(db, submission.reviewer_id)
        zipped_queue = apply_zipper_merge(new_queue)
        queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
        await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])
        
    return submission

async def get_played_queue(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status.in_(['played', 'reviewed'])
        )
        .order_by(models.Submission.submitted_at.desc())
    )
    return result.scalars().all()

import logging

logger = logging.getLogger(__name__)

async def get_bookmarked_submissions(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    try:
        result = await db.execute(
            select(models.Submission)
            .options(joinedload(models.Submission.user))
            .filter(
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.bookmarked == True
            )
            .order_by(models.Submission.submitted_at.desc())
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching bookmarked submissions: {e}")
        return []

async def get_spotlighted_submissions(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    try:
        result = await db.execute(
            select(models.Submission)
            .options(joinedload(models.Submission.user))
            .filter(
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.spotlighted == True
            )
            .order_by(models.Submission.submitted_at.desc())
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching spotlighted submissions: {e}")
        return []

async def get_active_submission(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    """Helper to retrieve the currently active submission for a reviewer."""
    return await get_current_track(db, reviewer_id)

async def get_current_track(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    # 1. Check Reviewer Configuration for active_track_id
    reviewer = await get_reviewer_by_id(db, reviewer_id)

    active_id = None
    if reviewer and reviewer.configuration:
        # Configuration might be a dict or string depending on driver/model
        config = reviewer.configuration
        if isinstance(config, str):
            import json
            try:
                config = json.loads(config)
            except:
                config = {}

        active_id = config.get('active_track_id')

    if active_id:
        result = await db.execute(
            select(models.Submission)
            .options(joinedload(models.Submission.user))
            .filter(models.Submission.id == active_id)
        )
        submission = result.scalars().first()
        if submission:
            return submission

    # 2. Fallback to 'playing' status
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'playing'
        )
    )
    return result.scalars().first()

async def get_initial_state(db: AsyncSession, reviewer_id: int) -> schemas.FullQueueState:
    # Trigger Lottery Check (Lazy Load) - Now Community Goal Check
    # We don't need to check time-based lottery if we are doing goal-based.
    # But we might want to keep it as a fallback? 
    # User said "it could either rotate or it could have a time".
    # Let's stick to Goal-Based for now as requested.
    # The listener updates the goal progress. We just need to read it.
    
    # Ensure goal exists in config
    reviewer = await get_reviewer_by_id(db, reviewer_id)
    config = _merge_reviewer_config(reviewer)
    if reviewer.configuration != config.configuration:
        reviewer.configuration = config.configuration
        flag_modified(reviewer, "configuration")
        await db.commit()

    queue = await get_pending_queue(db, reviewer_id)
    zipped_queue = apply_zipper_merge(queue)
    history = await get_played_queue(db, reviewer_id)
    bookmarks = await get_bookmarked_submissions(db, reviewer_id)
    spotlight = await get_spotlighted_submissions(db, reviewer_id)
    current_track = await get_current_track(db, reviewer_id)

    # Logic for wait time is implicitly handled by frontend or can be added to a Stats object
    # But since FullQueueState structure is fixed in schemas, we might need to add stats there if needed
    # The user asked for "Live Stats" on the card. Frontend can calculate it from queue.length * 4.
    # But let's make sure we export the constant or handle it.
    # For now, frontend calculation is sufficient given the schema.

    # Check for active LiveSession
    is_live = False
    reviewer = await get_reviewer_by_id(db, reviewer_id)
    if reviewer:
        stmt_live = select(models.LiveSession).filter(
            models.LiveSession.user_id == reviewer.user_id,
            models.LiveSession.status == 'LIVE'
        )
        result_live = await db.execute(stmt_live)
        active_session = result_live.scalars().first()
        if active_session:
            is_live = True

    # Get Giveaway State
    giveaway_states = await giveaway_service.get_giveaway_states(db, reviewer_id)
    # For backward compatibility, return the first one or None
    giveaway_state = giveaway_states[0] if giveaway_states else None

    return schemas.FullQueueState(
        queue=[schemas.Submission.model_validate(s) for s in zipped_queue],
        history=[schemas.Submission.model_validate(s) for s in history],
        bookmarks=[schemas.Submission.model_validate(s) for s in bookmarks],
        spotlight=[schemas.Submission.model_validate(s) for s in spotlight],
        current_track=schemas.Submission.model_validate(current_track) if current_track else None,
        is_live=is_live,
        giveaway_state=giveaway_state
    )

async def get_giveaway_state(db: AsyncSession, reviewer_id: int) -> Optional[schemas.GiveawayState]:
    """
    Wrapper to fetch giveaway state from giveaway_service.
    """
    states = await giveaway_service.get_giveaway_states(db, reviewer_id)
    return states[0] if states else None

async def get_reviewer_stats(db: AsyncSession, reviewer_id: int) -> schemas.QueueStats:
    queue = await get_pending_queue(db, reviewer_id)
    reviewer = await get_reviewer_by_user_id(db, reviewer_id) # Wait, get_reviewer_by_user_id takes user_id, not reviewer_id

    # We need to get reviewer by ID to check status
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer_obj = result.scalars().first()
    status = reviewer_obj.queue_status if reviewer_obj else "closed"

    return schemas.QueueStats(
        length=len(queue),
        avg_wait_time=len(queue) * AVERAGE_REVIEW_TIME_MINUTES,
        status=status
    )

async def update_submission_details(db: AsyncSession, submission_id: int, update_data: schemas.SubmissionUpdate) -> models.Submission:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Submission not found")

    # Update submission fields
    if update_data.track_title is not None:
        submission.track_title = update_data.track_title
    if update_data.start_time is not None:
        submission.start_time = update_data.start_time
    if update_data.end_time is not None:
        submission.end_time = update_data.end_time
    if update_data.genre is not None:
        submission.genre = update_data.genre
    if update_data.tags is not None:
        submission.tags = update_data.tags
    if update_data.hook_start_time is not None:
        submission.hook_start_time = update_data.hook_start_time
    if update_data.hook_end_time is not None:
        submission.hook_end_time = update_data.hook_end_time

    # Update User Profile fields if provided
    if update_data.tiktok_handle is not None:
        # Update the user's tiktok handle
        # We can access submission.user directly
        submission.user.tiktok_username = update_data.tiktok_handle

    await db.commit()
    await db.refresh(submission)

    # Emit queue update because details changed
    # We need to know if it is in pending queue or history to emit to right channel?
    # Actually, simplest is to emit to both or just check status.
    # If pending, emit queue update.
    if submission.status == 'pending':
        new_queue = await get_pending_queue(db, submission.reviewer_id)
        zipped_queue = apply_zipper_merge(new_queue)
        queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
        await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])
    elif submission.status in ['played', 'reviewed']:
        # If history, emit history update?
        # Maybe not strictly necessary for editing history items, but good for consistency.
        pass

    return submission

async def review_submission(db: AsyncSession, submission_id: int, review: schemas.ReviewCreate) -> models.Submission:
    # FIXED: Load user
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.score = review.score
    submission.notes = review.notes
    submission.status = 'reviewed'

    # Update Reviewer (Host) stats - Gamification
    # Wait, the user (artist) gets stats when graded. The Reviewer gets stats from streaming.
    # But we might want to track "Graded Submissions" for the Reviewer?
    # PRD: "Artist Stats -> total_submissions_graded". This refers to the Artist's tracks that have been graded.
    # So we update the SUBMISSION USER (Artist).
    artist_user = submission.user
    artist_user.total_submissions_graded = (artist_user.total_submissions_graded or 0) + 1

    # Update Average Score
    # We need to query all graded submissions for this user to calculate accurate average
    from sqlalchemy import func
    avg_stmt = select(func.avg(models.Submission.score))\
        .filter(models.Submission.user_id == artist_user.id, models.Submission.score.isnot(None))
    avg_res = await db.execute(avg_stmt)
    new_avg = avg_res.scalar()
    if new_avg is not None:
        artist_user.average_review_score = float(new_avg)

    db.add(artist_user)

    # --- CATEGORY A ACHIEVEMENTS CHECK (Review Time) ---
    # 1. Critics Choice
    if review.score >= 10:
         await achievement_service.trigger_achievement(db, artist_user.id, "REVIEW_SCORE", 10) # Checks threshold

    # 2. Win Streak (Certified Gold/Platinum)
    # Fetch last N submissions for this user, ordered by date desc
    history_stmt = select(models.Submission).filter(
        models.Submission.user_id == artist_user.id,
        models.Submission.score.isnot(None)
    ).order_by(models.Submission.submitted_at.desc()).limit(10)
    history = (await db.execute(history_stmt)).scalars().all()

    # Calculate streak (including current one which is now in history effectively or about to be)
    # The current submission has score but might not be in the query result if not committed yet?
    # Actually we just set `submission.score` but didn't commit yet. So query might miss it if using DB snapshot.
    # We should rely on `submission` object + history.

    streak = 0
    # Add current one
    if submission.score >= 7: # Assuming 7+ is a "W"?
        # Requirement says "Get a 'W' (Win)".
        # Typically "W" is determined by Polls, but here we are in "Review".
        # However, "Category A" table says "Get a 'W' (Win) on 3 consecutive submissions".
        # Is 'W' from Poll or Review Score?
        # "Crowd Fav" says ">90% W votes". That implies Poll.
        # But "Certified Gold" is "3 Win Streak".
        # If it's poll based, we can't trigger it here in `review_submission` (host score).
        # We must trigger it when Poll results are finalized?
        # But wait, usually Poll runs while track plays.
        # Let's assume 'Win' here means Poll Win OR High Score?
        # User clarification: "Community's votes via Polls".
        # So "Certified Gold" likely refers to Poll Wins.
        # I will implement it here IF we have poll result, but usually poll result comes from TikTok Listener/Bot.
        # For now, I will check "The Comeback" which is Score based.
        pass

    # 3. The Comeback (Score <4 then >8)
    if len(history) >= 1:
        last_sub = history[0] # This is the previous one in DB (since current is not committed yet or just updated)
        # Wait, if we haven't committed, `history` won't have the current one.
        if last_sub.id != submission.id: # Ensure we are looking at previous
            if last_sub.score and last_sub.score < 4 and submission.score > 8:
                 await achievement_service.trigger_achievement(db, artist_user.id, "SCORE_SWING", 1)

    await db.commit()

    # Don't refresh, we have the object and updated it. Refreshing might strip relations if not careful.

    # Emit a history update
    new_history = await get_played_queue(db, submission.reviewer_id)
    history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
    await broadcast_service.emit_history_update(submission.reviewer_id, [s.model_dump(mode='json') for s in history_schemas])

    # Emit a queue update to remove the reviewed submission from the queue list
    new_queue = await get_pending_queue(db, submission.reviewer_id)
    zipped_queue = apply_zipper_merge(new_queue)
    queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
    await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump(mode='json') for s in queue_schemas])

    # Emit current track update (clearing it, or keeping it as reviewed? Usually we move to next, but for now let's just update it)
    # Actually, if we just reviewed it, it's no longer "playing" in the sense of "waiting to be reviewed", but it might still be the current track until "Next" is clicked.
    # However, the user wants it to move to history.
    # If we change status to 'reviewed', get_current_track will return None.
    # So we should emit a null current track update? Or let the frontend handle it?
    # The frontend ReviewHub handles "Submit & Next".
    # If we just submit, we might want to keep showing it until we click next.
    # But the request says "submissions should only be removed from the queue and added to the list when that submission has the submit review and next track button pressed".
    # Wait, "Submit & Next" is one button.
    # So when that button is pressed, we call review_submission (which updates status) AND THEN we call next_track (which calls advance_queue).
    # Actually, ReviewHub calls `handleSubmitReview` which calls `review_submission`.
    # Then it calls `handleNextTrack` if not historical.
    # So `review_submission` should indeed move it to history.
    
    # Emit current track update (clearing it, or keeping it as reviewed? Usually we move to next, but for now let's just update it)
    # Actually, if we just reviewed it, it's no longer "playing" in the sense of "waiting to be reviewed", but it might still be the current track until "Next" is clicked.
    # However, the user wants it to move to history.
    # If we change status to 'reviewed', get_current_track will return None.
    # So we should emit a null current track update? Or let the frontend handle it?
    # The frontend ReviewHub handles "Submit & Next".
    # If we just submit, we might want to keep showing it until we click next.
    # But the request says "submissions should only be removed from the queue and added to the list when that submission has the submit review and next track button pressed".
    # This implies the action is atomic or sequential.
    # If I click "Submit & Next", it does both.
    # If I just click "Save" (on played), it updates review.
    
    # Let's stick to the plan: review_submission sets status to 'reviewed'.
    # And we emit history update.
    # We should also probably emit current_track_update with the reviewed submission so clients see the score/notes?
    # Yes.
    submission_schema = schemas.Submission.model_validate(submission)
    await broadcast_service.emit_current_track_update(submission.reviewer_id, submission_schema.model_dump(mode='json'))

    return submission

async def create_session(db: AsyncSession, reviewer_id: int, name: str, open_queue_tiers: Optional[list[int]] = None) -> models.ReviewSession:
    await db.execute(
        update(models.ReviewSession)
        .where(models.ReviewSession.reviewer_id == reviewer_id)
        .values(is_active=False)
    )

    # If open_queue_tiers is not provided, default to ALL tiers from reviewer config
    if open_queue_tiers is None:
        # Fetch reviewer to get config
        reviewer = await get_reviewer_by_id(db, reviewer_id)
        if reviewer and reviewer.configuration and "priority_tiers" in reviewer.configuration:
            open_queue_tiers = [t["value"] for t in reviewer.configuration["priority_tiers"]]
        else:
            # Fallback defaults if no config
            open_queue_tiers = [0, 5, 10, 15, 20, 25, 50]

    new_session = models.ReviewSession(
        reviewer_id=reviewer_id,
        name=name,
        is_active=True,
        open_queue_tiers=open_queue_tiers
    )
    db.add(new_session)
    
    # Automate Queue Status: Open if Free tier (0) is active, else Closed
    new_status = "open" if 0 in open_queue_tiers else "closed"
    await set_queue_status(db, reviewer_id, new_status)

    await db.commit()

    # FIXED: Nested loading of submissions and their users
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == new_session.id)
    )
    return result.scalars().first()

async def get_sessions_by_reviewer(db: AsyncSession, reviewer_id: int) -> list[models.ReviewSession]:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.reviewer_id == reviewer_id)
    )
    return result.scalars().all()

async def get_active_session_by_reviewer(db: AsyncSession, reviewer_id: int) -> Optional[models.ReviewSession]:
    # FIXED: Nested loading of submissions.user so Pydantic can serialize it
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(
            models.ReviewSession.reviewer_id == reviewer_id,
            models.ReviewSession.is_active == True
        )
        .order_by(models.ReviewSession.id.desc())
    )
    return result.scalars().first()

async def activate_session(db: AsyncSession, reviewer_id: int, session_id: int) -> models.ReviewSession:
    await db.execute(
        update(models.ReviewSession)
        .where(models.ReviewSession.reviewer_id == reviewer_id)
        .values(is_active=False)
    )

    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = True
    await db.commit()
    return session

async def archive_session(db: AsyncSession, reviewer_id: int, session_id: int) -> models.ReviewSession:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    
    # Archive all pending submissions for this reviewer
    # This effectively clears the queue
    pending_result = await db.execute(
        select(models.Submission)
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status.in_(['pending', 'playing', 'played', 'reviewed'])
        )
    )
    pending_submissions = pending_result.scalars().all()
    
    for sub in pending_submissions:
        sub.status = 'archived'
        
    await db.commit()
    
    # Emit empty queue update
    await broadcast_service.emit_queue_update(reviewer_id, [])
    
    return session

async def update_session(db: AsyncSession, reviewer_id: int, session_id: int, session_update: schemas.ReviewSessionUpdate) -> models.ReviewSession:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    update_data = session_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session, key, value)

    # Automate Queue Status on update if tiers changed
    if "open_queue_tiers" in update_data:
        tiers = update_data["open_queue_tiers"]
        # If tiers is None (which shouldn't happen with exclude_unset=True unless explicitly set to None), handle it
        if tiers is not None:
            new_status = "open" if 0 in tiers else "closed"
            await set_queue_status(db, reviewer_id, new_status)

    await db.commit()
    return session

async def get_session_by_id(db: AsyncSession, session_id: int) -> Optional[models.ReviewSession]:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id)
    )
    return result.scalars().first()

async def get_submissions_by_session(db: AsyncSession, session_id: int) -> list[models.Submission]:
    # FIXED: Load user
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.session_id == session_id)
    )
    return result.scalars().all()

async def remove_submission(db: AsyncSession, submission_id: int) -> Optional[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    
    if not submission:
        return None
        
    submission.status = 'rejected'
    await db.commit()
    
    # Emit queue update
    new_queue = await get_pending_queue(db, submission.reviewer_id)
# If we just submit, we might want to keep showing it until we click next.
    # But the request says "submissions should only be removed from the queue and added to the list when that submission has the submit review and next track button pressed".
    # This implies the action is atomic or sequential.
    # If I click "Submit & Next", it does both.
    # If I just click "Save" (on played), it updates review.
    
    # Let's stick to the plan: review_submission sets status to 'reviewed'.
    # And we emit history update.
    # We should also probably emit current_track_update with the reviewed submission so clients see the score/notes?
    # Yes.
    submission_schema = schemas.Submission.model_validate(submission)
    await broadcast_service.emit_current_track_update(submission.reviewer_id, submission_schema.model_dump(mode='json'))

    return submission

async def process_gift_interaction(db: AsyncSession, reviewer_id: int, tiktok_username: str, gift_coins: int) -> str:
    """
    Determines how to handle a gift interaction.
    Returns: 'GOAL', 'SKIP_UPGRADE', 'COINS', or 'NONE'
    """
    # 1. Define Thresholds
    SKIP_THRESHOLD = 500 # Minimum coins to be considered for a skip
    
    # 2. Check if Gift is below Skip Threshold
    if gift_coins < SKIP_THRESHOLD:
        return 'GOAL'

    # 3. Gift is >= 500. Check if it maps to an OPEN tier.
    active_session = await get_active_session_by_reviewer(db, reviewer_id)
    open_tiers = active_session.open_queue_tiers if active_session else []
    
    # Calculate max potential priority value (e.g. 500 coins -> 5, 1200 coins -> 12)
    max_potential_priority = gift_coins // 100
    
    # Find the highest open tier that fits within this budget
    valid_tiers = [t for t in open_tiers if t <= max_potential_priority and t > 0]
    
    if not valid_tiers:
        # No open line for this amount.
        # Fallback to coins.
        return 'COINS'
        
    target_priority = max(valid_tiers)

    # 4. Check for User and Pending Submission
    user = await user_service.get_user_by_tiktok_username(db, tiktok_username)
    if not user:
        return 'COINS'
        
    stmt = select(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.user_id == user.id,
        models.Submission.status == 'pending'
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()
    
    if not submission:
        return 'COINS'
        
    # 5. Check if this improves their current priority
    if target_priority > submission.priority_value:
        # Upgrade!
        await update_priority(db, submission.id, target_priority)
        return 'SKIP_UPGRADE'
        
    # If they are already at this priority or higher, just give them coins.
    return 'COINS'

async def apply_free_skip(db: AsyncSession, reviewer_id: int, user_id: int) -> bool:
    """
    Applies a free skip (priority upgrade) to the user's pending submission.
    Typically upgrades to priority value 3 (Fast Pass).
    Returns True if applied, False if no pending submission found.
    """
    # 1. Find pending submission
    stmt = select(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.user_id == user_id,
        models.Submission.status == 'pending'
    )
    result = await db.execute(stmt)
    submission = result.scalars().first()
    
    if not submission:
        return False
        
    # 2. Apply Upgrade
    # Fetch reviewer config to find the lowest paid tier or use configured override
    reviewer = await db.get(models.Reviewer, reviewer_id)
    free_skip_value = 3 # Default fallback
    
    if reviewer and reviewer.configuration:
        # Check for manual override first
        configured_value = reviewer.configuration.get("free_skip_priority_value")
        if configured_value and isinstance(configured_value, int) and configured_value > 0:
            free_skip_value = configured_value
        else:
            # Fallback to lowest paid tier
            tiers = reviewer.configuration.get("priority_tiers", [])
            # Filter for paid tiers (value > 0) and find the minimum
            paid_tiers = [t for t in tiers if t.get("value", 0) > 0]
            if paid_tiers:
                free_skip_value = min(t["value"] for t in paid_tiers)
            
    if submission.priority_value < free_skip_value:
        await update_priority(db, submission.id, free_skip_value)
        
        # Mark as winner in notes for frontend display
        # We append the tag if it's not already there
        winner_tag = "[Free Skip Winner]"
        current_notes = submission.notes or ""
        if winner_tag not in current_notes:
            if current_notes:
                submission.notes = f"{current_notes} {winner_tag}"
            else:
                submission.notes = winner_tag
            # We need to commit this change since update_priority might not handle notes
            # But update_priority commits, so we should do this before or after?
            # update_priority commits. So we need to commit again or do it all in one go.
            # Ideally update_priority should handle it, but we can just commit here.
            await db.commit()
            
        return True
        
    return False
