from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, case, and_
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from services import queue_service, user_service
from security import get_current_user
from typing import List, Optional
import logging
import models
import schemas
from database import get_db

router = APIRouter(
    prefix="/queue/line",
    tags=["Queue Line"],
)

logger = logging.getLogger(__name__)


async def calculate_estimated_wait_time(db: AsyncSession, reviewer_id: int, position: int) -> int:
    """
    Calculate estimated wait time in minutes based on position in queue.
    Uses a simple estimate of 3-5 minutes per song as default.
    """
    # TODO: Calculate actual average from historical data in the future
    avg_time_per_song = 4  # minutes
    return position * avg_time_per_song


async def get_total_waiting_count(db: AsyncSession, reviewer_id: int) -> int:
    """
    Get total count of all pending free submissions (priority_value = 0) for a reviewer.
    """
    stmt = select(func.count(models.Submission.id)).where(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status.in_(['pending', 'playing']),
        models.Submission.priority_value == 0,
        models.Submission.spotlighted == False
    )
    result = await db.execute(stmt)
    return result.scalar() or 0


async def find_user_submissions_in_queue(db: AsyncSession, user_discord_id: str, reviewer_id: int) -> List[dict]:
    """
    Find all of user's submissions in the queue and calculate their positions.
    Returns list of dicts with submission_id, position, and other metadata.
    """
    # Get all pending submissions for this reviewer, sorted by priority desc, then created_at asc
    stmt = select(models.Submission).options(joinedload(models.Submission.user)).where(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status.in_(['pending', 'playing']),
        models.Submission.spotlighted == False
    ).order_by(
        models.Submission.priority_value.desc(),
        models.Submission.submitted_at.asc()
    )
    
    result = await db.execute(stmt)
    all_submissions = result.scalars().all()
    
    user_submissions = []
    for idx, sub in enumerate(all_submissions, start=1):
        if sub.user.discord_id == user_discord_id:
            user_submissions.append({
                "submission_id": sub.id,
                "position": idx,
                "priority_value": sub.priority_value,
                "track_title": sub.track_title
            })
    
    return user_submissions


@router.get("/{reviewer_identifier}", response_model=schemas.LineViewState)
async def get_line_view(
    reviewer_identifier: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public (but restricted) view of the queue line with nightclub aesthetic data structure.
    """
    # 1. Check Access
    # is_authorized = await user_service.is_user_authorized_for_line(db, current_user.discord_id)
    # if not is_authorized:
    #      raise HTTPException(status_code=403, detail="You must be a member of the authorized Discord server to view this page.")

    # 2. Resolve Reviewer
    reviewer = None
    if reviewer_identifier.isdigit():
        reviewer = await queue_service.get_reviewer_by_id(db, int(reviewer_identifier))
    else:
        reviewer = await queue_service.get_reviewer_by_tiktok_handle(db, reviewer_identifier)

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # 3. Fetch Queue State
    full_state = await queue_service.get_initial_state(db, reviewer.id)
    
    # 4. Apply Reviewer Configuration
    config = reviewer.configuration or {}
    if isinstance(config, str):
        import json
        try:
            config = json.loads(config)
        except:
            config = {}

    show_skips = config.get('line_show_skips', True)
    free_limit = config.get('free_line_limit', 20)  # Default to 20 if not set
    priority_tiers_data = config.get('priority_tiers', [])
    priority_tiers = [schemas.PriorityTier(**t) for t in priority_tiers_data]
    
    # 5. Separate Queue into Priority and Free
    priority_queue_items = []
    free_queue_items = []
    
    # We iterate through the zipped queue to preserve order, but separate them for display
    # Actually, for the new design, we want them separated.
    # The full_state.queue is already zipped.
    # We should probably re-sort or just filter.
    # But wait, the frontend expects them separated.
    
    # Helper to check for public links
    def is_public_link(url: str) -> bool:
        if not url:
            return False
        whitelist = ['spotify.com', 'youtube.com', 'youtu.be', 'soundcloud.com']
        return any(domain in url.lower() for domain in whitelist)

    for idx, sub in enumerate(full_state.queue, start=1):
        if sub.spotlighted:
            continue
            
        # Determine if track_url should be exposed
        safe_track_url = sub.track_url if is_public_link(sub.track_url) else None

        if sub.priority_value > 0:
            # Priority Item
            style = "GOLD" if sub.priority_value >= 50 else "FIRE" # Simple logic for now
            priority_queue_items.append(schemas.PriorityQueueItem(
                pos=idx, # Use global position or relative? Let's use global for now
                submission_id=sub.id,
                user=sub.user.username,
                type="PAID_PRIORITY",
                amount=sub.priority_value, # Using priority value as amount proxy
                style=style,
                track_title=sub.track_title,
                artist=sub.artist,
                track_url=safe_track_url,
                is_community_winner=sub.is_community_winner
                # cover_art_url=sub.cover_art_url # TODO: Add to model if needed
            ))
        else:
            # Free Item
            free_queue_items.append(schemas.FreeQueueItem(
                pos=idx,
                submission_id=sub.id,
                user=sub.user.username,
                track_title=sub.track_title,
                artist=sub.artist,
                track_url=safe_track_url
                # cover_art_url=sub.cover_art_url
            ))
            
    # 6. Get Total Waiting Count (Free)
    total_free_waiting = len(free_queue_items)
    
    # 7. Apply Free Limit
    if free_limit and isinstance(free_limit, int) and free_limit > 0:
        free_queue_items = free_queue_items[:free_limit]
        
    # 8. Construct FreeQueue Object
    free_queue = schemas.FreeQueue(
        display_limit=free_limit or 20,
        total_waiting=total_free_waiting,
        items=free_queue_items
    )
    
    # 9. Dynamic Pricing Logic
    # Green Tier (Line < 10): $3.99
    # Yellow Tier (Line 10-50): $9.99
    # Red Tier (Line 50+): $19.99
    
    surge_price = 3.99
    surge_label_suffix = ""
    surge_color_override = None
    
    if total_free_waiting >= 50:
        surge_price = 19.99
        surge_label_suffix = " 🔥 High Demand"
        surge_color_override = "red"
    elif total_free_waiting >= 10:
        surge_price = 9.99
        surge_label_suffix = " 🚀 Priority"
        surge_color_override = "yellow"
        
    # Apply to lowest tier (Skip)
    # We respect the reviewer's tiers but enforce the surge minimum price
    
    if priority_tiers:
        # Find lowest priced tier
        min_tier = min(priority_tiers, key=lambda t: t.value)
        
        # Update if surge price is higher than their set price
        if surge_price > min_tier.value:
            min_tier.value = surge_price
            min_tier.label = f"{min_tier.label}{surge_label_suffix}"
            if surge_color_override:
                min_tier.color = surge_color_override
    else:
        # Fallback if no tiers exist
        priority_tiers = [
            schemas.PriorityTier(
                value=surge_price,
                label=f"Skip the Line{surge_label_suffix}",
                color=surge_color_override or "green",
                description="Jump the line immediately"
            )
        ]

    # 10. Filter Spotlights
    active_spotlights = [s.model_dump() for s in full_state.spotlight] # Convert to dict for schema
    
    # 11. Construct Mission Bar
    mission_bar = None
    community_goal = config.get('community_goal')
    if community_goal:
        # Calculate percent
        current = community_goal.get('current', 0)
        target = community_goal.get('target', 1000)
        percent = int((current / target) * 100) if target > 0 else 0
        
        mission_bar = schemas.MissionBar(
            status="Active", # Could be dynamic
            type=community_goal.get('type', 'LIKES'),
            target=target,
            current=current,
            percent=percent
        )

    # 12. Construct Now Playing
    now_playing = None
    if full_state.current_track:
        # Try to get cover art if available (e.g. from meta_data or if we add it to model later)
        cover_art = None
        # if hasattr(full_state.current_track, 'cover_art_url'):
        #     cover_art = full_state.current_track.cover_art_url
            
        now_playing = schemas.NowPlayingInfo(
            track_title=full_state.current_track.track_title,
            artist=full_state.current_track.artist,
            cover_art_url=cover_art,
            user=full_state.current_track.user,
            mission_bar=mission_bar
        )
    
    # 13. Find User Context
    user_submissions = await find_user_submissions_in_queue(db, current_user.discord_id, reviewer.id)
    user_status = None
    
    if user_submissions:
        # Use the first one for primary display (highest priority/earliest)
        primary_sub = user_submissions[0]
        est_wait = await calculate_estimated_wait_time(db, reviewer.id, primary_sub['position'])
        
        # Calculate est wait for all
        for sub in user_submissions:
            sub['est_wait_minutes'] = await calculate_estimated_wait_time(db, reviewer.id, sub['position'])

        user_status = {
            "is_in_queue": True,
            "position": primary_sub['position'],
            "est_wait_minutes": est_wait,
            "submission_id": primary_sub['submission_id'],
            "submissions": user_submissions # Include all
        }
    else:
        user_status = {
            "is_in_queue": False
        }
    
    # 14. Construct Response
    return schemas.LineViewState(
        session_id=f"live_session_{reviewer.id}",
        status="active" if full_state.is_live else "inactive",
        now_playing=now_playing,
        priority_queue=priority_queue_items,
        free_queue=free_queue,
        user_status=user_status,
        spotlights=active_spotlights,
        is_live=full_state.is_live,
        pricing_tiers=priority_tiers,
        giveaway_state=full_state.giveaway_state,
        reviewer=reviewer
    )


@router.post("/{reviewer_identifier}/vote")
async def vote_on_track(
    reviewer_identifier: str,
    vote_type: str, # "fire" or "trash"
    db: AsyncSession = Depends(get_db),
    current_user: schemas.TokenData = Depends(get_current_user)
):
    """
    Handle user votes (Fire/Trash) on the current track.
    Updates community goal progress and potentially sends chat message.
    """
    # 1. Resolve Reviewer
    reviewer = None
    if reviewer_identifier.isdigit():
        reviewer = await queue_service.get_reviewer_by_id(db, int(reviewer_identifier))
    else:
        reviewer = await queue_service.get_reviewer_by_tiktok_handle(db, reviewer_identifier)

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # 2. Update Community Goal
    # We need to load the config, update it, and save it.
    # This is a bit heavy for high-frequency votes, but fine for now.
    
    config = reviewer.configuration or {}
    if isinstance(config, str):
        import json
        try:
            config = json.loads(config)
        except:
            config = {}
            
    community_goal = config.get('community_goal')
    if community_goal:
        # Increment current
        community_goal['current'] = community_goal.get('current', 0) + 1
        
        # Check if target reached (logic can be expanded)
        if community_goal['current'] >= community_goal.get('target', 1000):
            # Reset or trigger event?
            pass
            
        # Save back
        config['community_goal'] = community_goal
        
        # Update reviewer
        # We need to use a service method or direct DB update
        # Direct DB update for speed here, but service is better.
        # Let's use a helper in queue_service if possible, or just do it here.
        # Since we have the reviewer object attached to session:
        reviewer.configuration = config
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(reviewer, "configuration")
        await db.commit()
        
        # Emit update?
        # Ideally yes, but the polling frontend will catch it.
        
    # 3. Send to TikTok Chat (Mock/Placeholder)
    # TODO: Implement actual TikTok chat integration
    # For now, we just log it.
    logger.info(f"User {current_user.username} voted {vote_type} on reviewer {reviewer.id}")
    
    return {"status": "success", "vote": vote_type}


class UpgradeRequest(schemas.BaseModel):
    target_priority_value: int
    new_submissions: List[schemas.SmartSubmissionItem] = []


@router.post("/{reviewer_identifier}/submission/{submission_id}/upgrade")
async def upgrade_submission(
    reviewer_identifier: str,
    submission_id: int,
    request: UpgradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: schemas.TokenData = Depends(get_current_user)
):
    """
    Upgrade an existing submission to a higher priority tier.
    Can also add new submissions (Back to Back) if the tier supports it.
    Deducts coins from the user's wallet.
    """
    # 1. Resolve Reviewer
    reviewer = None
    if reviewer_identifier.isdigit():
        reviewer = await queue_service.get_reviewer_by_id(db, int(reviewer_identifier))
    else:
        reviewer = await queue_service.get_reviewer_by_tiktok_handle(db, reviewer_identifier)

    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # 2. Get Submission & Verify Ownership
    stmt = select(models.Submission).where(models.Submission.id == submission_id)
    result = await db.execute(stmt)
    submission = result.scalars().first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Verify ownership (using discord_id from token)
    # We need to fetch the user associated with the token to compare IDs
    user = await user_service.get_user_by_discord_id(db, current_user.discord_id)
    if not user or submission.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not own this submission")

    # 3. Calculate Cost
    current_value = submission.priority_value
    target_value = request.target_priority_value
    
    if target_value <= current_value:
        raise HTTPException(status_code=400, detail="Target tier must be higher than current tier")
        
    cost_coins = (target_value - current_value) * 100 # Assuming 100 coins per $1 value
    
    # 4. Check Wallet & Deduct
    from services import economy_service
    try:
        await economy_service.deduct_coins(
            db, 
            reviewer.id, 
            user.id, 
            cost_coins, 
            f"Upgrade submission #{submission.id} to ${target_value}"
        )
    except ValueError as e:
        raise HTTPException(status_code=402, detail="Insufficient funds. Please top up your wallet.")

    # 5. Update Existing Submission
    submission.priority_value = target_value
    submission.is_priority = True
    
    # Generate Batch ID if needed
    import uuid
    if not submission.batch_id:
        submission.batch_id = str(uuid.uuid4())
    
    batch_id = submission.batch_id
    
    # 6. Create New Submissions (if any)
    created_submissions = []
    if request.new_submissions:
        for item in request.new_submissions:
            new_sub = await queue_service.create_submission(
                db=db,
                reviewer_id=reviewer.id,
                user_id=user.id,
                track_url=item.track_url,
                track_title=item.track_title or "Untitled",
                archived_url=None, # TODO: Handle file uploads if needed, but for now assuming links or pre-uploaded
                batch_id=batch_id,
                sequence_order=item.sequence_order,
                hook_start_time=item.hook_start_time,
                hook_end_time=item.hook_end_time,
                priority_value=target_value,
                artist=item.artist,
                genre=item.genre
            )
            created_submissions.append(new_sub)

    await db.commit()
    
    # 7. Broadcast Updates
    # Update priority triggers queue update in queue_service.update_priority, but we did it manually here.
    # So we should call the helper or emit manually.
    # Also we added new submissions.
    
    # Let's just emit a full queue update
    new_queue = await queue_service.get_pending_queue(db, reviewer.id)
    zipped_queue = queue_service.apply_zipper_merge(new_queue)
    queue_schemas = [schemas.Submission.model_validate(s) for s in zipped_queue]
    from services import broadcast as broadcast_service
    await broadcast_service.emit_queue_update(reviewer.id, [s.model_dump(mode='json') for s in queue_schemas])

    return {"status": "success", "batch_id": batch_id, "upgraded_count": 1 + len(created_submissions)}
