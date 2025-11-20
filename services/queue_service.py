from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload, selectinload
import models
import schemas
from typing import Optional
from services import broadcast as broadcast_service
from services import user_service
import datetime

async def create_submission(db: AsyncSession, reviewer_id: int, user_id: int, track_url: str, track_title: str, archived_url: str, session_id: Optional[int] = None) -> models.Submission:
    new_submission = models.Submission(
        reviewer_id=reviewer_id,
        user_id=user_id,
        track_url=track_url,
        track_title=track_title,
        archived_url=archived_url,
        status='pending',
        session_id=session_id,
        priority_value=0 # Default to 0 (Free)
    )
    db.add(new_submission)

    # Award XP for submission
    await user_service.add_xp(db, user_id, 10) # Award 10 XP per submission

    await db.commit()

    # FIXED: Re-fetch the submission to eager-load the 'user' relationship for the API response
    stmt = select(models.Submission).options(joinedload(models.Submission.user)).filter(models.Submission.id == new_submission.id)
    result = await db.execute(stmt)
    loaded_submission = result.scalars().first()

    # Emit a queue update
    new_queue = await get_pending_queue(db, reviewer_id)
    queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
    await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])

    return loaded_submission

async def get_pending_queue(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'pending'
        )
        .order_by(models.Submission.priority_value.desc(), models.Submission.submitted_at.asc())
    )
    return result.scalars().all()

async def set_queue_status(db: AsyncSession, reviewer_id: int, status: str):
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()
    if reviewer:
        reviewer.queue_status = status
        await db.commit()
        await db.refresh(reviewer)
    return reviewer

async def advance_queue(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    # Get the next submission
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

    # We do NOT change status to 'playing' anymore. 
    # The track remains 'pending' (and in the queue) until reviewed.
    
    if submission:
        # Emit current track update so frontend knows what to play
        submission_schema = schemas.Submission.model_validate(submission)
        await broadcast_service.emit_current_track_update(reviewer_id, submission_schema.model_dump())

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
    queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
    await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])
    
    await broadcast_service.emit_current_track_update(reviewer_id, None)

async def get_reviewer_by_user_id(db: AsyncSession, user_id: int) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(joinedload(models.Reviewer.user))
        .filter(models.Reviewer.user_id == user_id)
    )
    return _merge_reviewer_config(result.scalars().first())

async def get_reviewer_by_channel_id(db: AsyncSession, channel_id: str) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(joinedload(models.Reviewer.user))
        .filter(models.Reviewer.discord_channel_id == str(channel_id))
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
        {"value": 0, "label": "Free", "color": "gray"},
        {"value": 5, "label": "$5 Tier", "color": "green"},
        {"value": 10, "label": "$10 Tier", "color": "blue"},
        {"value": 15, "label": "$15 Tier", "color": "purple"},
        {"value": 20, "label": "$20 Tier", "color": "yellow"},
        {"value": 25, "label": "$25 Tier", "color": "red"},
        {"value": 50, "label": "50+ Tier", "color": "pink"},
    ]

    if not reviewer.configuration:
        reviewer.configuration = {"priority_tiers": default_tiers}
    elif "priority_tiers" not in reviewer.configuration:
         # If config exists but no tiers, merge defaults
        reviewer.configuration["priority_tiers"] = default_tiers

    # Ensure the configuration is a valid dict (though SQLAlchemy handles JSON decoding)
    if isinstance(reviewer.configuration, str):
        import json
        try:
            reviewer.configuration = json.loads(reviewer.configuration)
        except json.JSONDecodeError:
             reviewer.configuration = {"priority_tiers": default_tiers}

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

        # Update priority tiers if present
        if "priority_tiers" in new_config:
             current_config["priority_tiers"] = new_config["priority_tiers"]

        reviewer.configuration = current_config

    await db.commit()
    await db.refresh(reviewer)

    # Re-fetch with user to return full object
    return await get_reviewer_by_user_id(db, reviewer.user_id)

async def get_submissions_by_user(db: AsyncSession, user_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user)) # FIXED: Load user
        .filter(models.Submission.user_id == user_id)
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
        queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
        await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump() for s in queue_schemas])
        
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

async def get_current_track(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'playing'
        )
    )
    return result.scalars().first()

AVERAGE_REVIEW_TIME_MINUTES = 4

async def get_initial_state(db: AsyncSession, reviewer_id: int) -> schemas.FullQueueState:
    queue = await get_pending_queue(db, reviewer_id)
    history = await get_played_queue(db, reviewer_id)
    bookmarks = await get_bookmarked_submissions(db, reviewer_id)
    spotlight = await get_spotlighted_submissions(db, reviewer_id)
    current_track = await get_current_track(db, reviewer_id)

    # Logic for wait time is implicitly handled by frontend or can be added to a Stats object
    # But since FullQueueState structure is fixed in schemas, we might need to add stats there if needed
    # The user asked for "Live Stats" on the card. Frontend can calculate it from queue.length * 4.
    # But let's make sure we export the constant or handle it.
    # For now, frontend calculation is sufficient given the schema.

    return schemas.FullQueueState(
        queue=[schemas.Submission.model_validate(s) for s in queue],
        history=[schemas.Submission.model_validate(s) for s in history],
        bookmarks=[schemas.Submission.model_validate(s) for s in bookmarks],
        spotlight=[schemas.Submission.model_validate(s) for s in spotlight],
        current_track=schemas.Submission.model_validate(current_track) if current_track else None,
    )

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
        queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
        await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump() for s in queue_schemas])
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
    await db.commit()
    # Don't refresh, we have the object and updated it. Refreshing might strip relations if not careful.

    # Emit a history update
    new_history = await get_played_queue(db, submission.reviewer_id)
    history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
    await broadcast_service.emit_history_update(submission.reviewer_id, [s.model_dump() for s in history_schemas])

    # Emit a queue update to remove the reviewed submission from the queue list
    new_queue = await get_pending_queue(db, submission.reviewer_id)
    queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
    await broadcast_service.emit_queue_update(submission.reviewer_id, [s.model_dump() for s in queue_schemas])

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
    
    # We should probably NOT emit a current_track_update here that clears it, because the user might still be looking at it.
    # But if status is 'reviewed', it won't be picked up by 'get_current_track'.
    # So if the frontend refreshes, it might disappear from "Now Playing" if we rely solely on 'playing' status.
    # But `ReviewHub` uses `currentTrack` from store.
    # If we update the submission, `updateSubmission` in store updates it.
    # So we don't strictly need to emit current_track_update here if the frontend handles the response.
    # BUT, other clients (viewers) need to know.
    # If I review it, it goes to history. Does it stay as current track for viewers?
    # Usually yes, until next track.
    # So maybe 'reviewed' status should also be considered "current" if it was just playing?
    # Or maybe we shouldn't change status to 'reviewed' until we click next?
    # But the user said "submissions should only be removed from the queue and added to the list when that submission has the submit review and next track button pressed".
    # This implies the action is atomic or sequential.
    # If I click "Submit & Next", it does both.
    # If I just click "Save" (on played), it updates review.
    
    # Let's stick to the plan: review_submission sets status to 'reviewed'.
    # And we emit history update.
    # We should also probably emit current_track_update with the reviewed submission so clients see the score/notes?
    # Yes.
    submission_schema = schemas.Submission.model_validate(submission)
    await broadcast_service.emit_current_track_update(submission.reviewer_id, submission_schema.model_dump())

    return submission

async def create_session(db: AsyncSession, reviewer_id: int, name: str, open_queue_tiers: Optional[list[int]] = None) -> models.ReviewSession:
    await db.execute(
        update(models.ReviewSession)
        .where(models.ReviewSession.reviewer_id == reviewer_id)
        .values(is_active=False)
    )

    new_session = models.ReviewSession(
        reviewer_id=reviewer_id,
        name=name,
        is_active=True,
        open_queue_tiers=open_queue_tiers
    )
    db.add(new_session)
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
    await db.commit()
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
