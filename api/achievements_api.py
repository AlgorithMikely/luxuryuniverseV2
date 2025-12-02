from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from database import get_db
from services import user_service
from security import get_current_user
from schemas import TokenData
import models
import schemas
from typing import List, Dict, Any

router = APIRouter()

@router.get("/user/achievements")
async def get_user_achievements(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Returns the user's gamification stats and achievements.
    """
    user = await user_service.get_user_by_discord_id(db, current_user.discord_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch all definitions
    stmt_defs = select(models.AchievementDefinition)
    result_defs = await db.execute(stmt_defs)
    definitions = result_defs.scalars().all()

    # Fetch user's unlocked achievements
    stmt_unlocked = select(models.UserAchievement).filter(models.UserAchievement.user_id == user.id)
    result_unlocked = await db.execute(stmt_unlocked)
    unlocked_map = {ua.achievement_id: ua for ua in result_unlocked.scalars().all()}

    # Fetch stats for progress bars
    # Submission count
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(models.Submission).filter(models.Submission.user_id == user.id)
    res_count = await db.execute(count_stmt)
    submission_count = res_count.scalar() or 0

    # Max Viewers
    max_viewers_stmt = select(models.LiveSession.max_concurrent_viewers)\
        .filter(models.LiveSession.user_id == user.id)\
        .order_by(models.LiveSession.max_concurrent_viewers.desc())\
        .limit(1)
    res_max = await db.execute(max_viewers_stmt)
    max_viewers = res_max.scalar_one_or_none() or 0

    # Filter definitions based on role
    # If user is NOT a reviewer, hide Streamer specific achievements
    is_reviewer = user.reviewer_profile is not None
    
    filtered_definitions = []
    streamer_categories = ["LIFETIME_LIKES", "LIFETIME_DIAMONDS", "CONCURRENT_VIEWERS"]
    
    for ach in definitions:
        if not is_reviewer and ach.category in streamer_categories:
            continue
        filtered_definitions.append(ach)

    badges = []
    for ach in filtered_definitions:
        is_unlocked = ach.id in unlocked_map
        unlocked_date = unlocked_map[ach.id].unlocked_at if is_unlocked else None
        role_status = unlocked_map[ach.id].discord_sync_status if is_unlocked else None

        # Calculate Progress
        progress = 0
        current_value = 0

        if ach.category == "LIFETIME_LIKES":
            current_value = user.lifetime_live_likes or 0
        elif ach.category == "LIFETIME_DIAMONDS":
            current_value = user.lifetime_diamonds or 0
        elif ach.category == "CONCURRENT_VIEWERS":
            current_value = max_viewers
        elif ach.category == "SUBMISSION_COUNT":
            current_value = submission_count
        elif ach.category == "DISCORD_MSG_COUNT":
            current_value = user.discord_msg_count or 0
        elif ach.category == "DISCORD_VOICE_MINS":
            current_value = user.discord_voice_mins or 0
        elif ach.category == "LIFETIME_LIKES_SENT":
            current_value = user.lifetime_likes_sent or 0
        elif ach.category == "LIFETIME_GIFTS_SENT":
            current_value = user.lifetime_gifts_sent or 0
        elif ach.category == "LIFETIME_TIKTOK_COMMENTS":
            current_value = user.lifetime_tiktok_comments or 0
        elif ach.category == "LIFETIME_TIKTOK_SHARES":
            current_value = user.lifetime_tiktok_shares or 0
        elif ach.category == "DISCORD_SCREEN_SHARE_MINS":
            # TODO: We need to track this in User model too if we want progress bars
            # For now, assume 0 or handle via separate tracking service
            current_value = 0 
        # Boolean types (Poll/Score) are either 0 or 100% effectively for progress bar unless we query max
        elif ach.category == "POLL_WIN_PERCENT":
            # Show max poll percent achieved? Too expensive to query max every time?
            # Just show 0 or 100 for now.
            current_value = 100 if is_unlocked else 0
        elif ach.category == "REVIEW_SCORE":
             current_value = 10 if is_unlocked else 0

        if ach.threshold_value > 0:
            progress = min((current_value / ach.threshold_value) * 100, 100)

        # Lazy Unlock Check: If we have the stats but no record, unlock it now!
        if not is_unlocked and current_value >= ach.threshold_value:
            try:
                from services import achievement_service
                # We trigger it to persist the unlock
                await achievement_service.trigger_achievement(db, user.id, ach.category, value=current_value, specific_slug=ach.slug)
                
                # Update local state for the response
                is_unlocked = True
                from datetime import datetime
                unlocked_date = datetime.now()
                role_status = "PENDING"
                progress = 100
            except Exception as e:
                print(f"Error auto-unlocking {ach.slug}: {e}")

        badges.append({
            "slug": ach.slug,
            "name": ach.display_name,
            "description": ach.description,
            "unlocked": is_unlocked,
            "unlocked_at": unlocked_date,
            "role_status": role_status,
            "reward_role_id": ach.discord_role_id,
            "progress": round(progress, 1),
            "current_value": current_value,
            "threshold_value": ach.threshold_value,
            "category": ach.category,
            "role_color": ach.role_color,
            "role_icon": ach.role_icon
        })

    response_data = {
        "artist_stats": {
            "submissions": submission_count,
            "avg_score": float(user.average_review_score or 0)
        },
        "badges": badges
    }

    # Only include streamer stats if reviewer
    if is_reviewer:
        response_data["streamer_stats"] = {
            "likes": user.lifetime_live_likes,
            "diamonds": user.lifetime_diamonds,
            "viewers_peak": max_viewers
        }
    else:
        # For non-reviewers, maybe show "Super Fan" stats?
        response_data["fan_stats"] = {
            "likes_sent": user.lifetime_likes_sent or 0,
            "gifts_sent": user.lifetime_gifts_sent or 0,
            "comments_sent": user.lifetime_tiktok_comments or 0,
            "shares_sent": user.lifetime_tiktok_shares or 0
        }

    return response_data
