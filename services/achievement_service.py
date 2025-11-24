from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

async def check_achievements(db: AsyncSession, user_id: int, trigger_type: str):
    """
    Checks and unlocks achievements for a user based on the trigger type.
    trigger_type: 'reviewer' (Live Stats), 'artist' (Submission Stats), 'community' (Discord Activity)
    """
    try:
        # 1. Fetch User with stats
        user = await db.get(models.User, user_id)
        if not user:
            return

        # 2. Fetch all definitions relevant to the trigger
        # We can optimize by filtering category, but fetching all is fine for small sets
        stmt = select(models.AchievementDefinition)
        result = await db.execute(stmt)
        all_definitions = result.scalars().all()

        # 3. Fetch existing unlocked achievements
        stmt_existing = select(models.UserAchievement).filter(models.UserAchievement.user_id == user_id)
        result_existing = await db.execute(stmt_existing)
        existing_ids = {ua.achievement_id for ua in result_existing.scalars().all()}

        new_unlocks = []

        for ach in all_definitions:
            if ach.id in existing_ids:
                continue

            unlocked = False

            # Track A: Reviewer
            if ach.category == "LIFETIME_LIKES":
                if (user.lifetime_live_likes or 0) >= ach.threshold_value:
                    unlocked = True
            elif ach.category == "LIFETIME_DIAMONDS":
                if (user.lifetime_diamonds or 0) >= ach.threshold_value:
                    unlocked = True
            elif ach.category == "CONCURRENT_VIEWERS":
                # Need to check max viewers from LiveSessions?
                # PRD says "Triggered by Flush worker".
                # We can check the user's latest live session max, or if we store a lifetime max on user.
                # Current schema has lifetime_live_likes but not lifetime_max_viewers on User.
                # We have it on LiveSession.
                # Let's query max from sessions.
                max_viewers_stmt = select(models.LiveSession.max_concurrent_viewers)\
                    .filter(models.LiveSession.user_id == user_id)\
                    .order_by(models.LiveSession.max_concurrent_viewers.desc())\
                    .limit(1)
                res = await db.execute(max_viewers_stmt)
                max_v = res.scalar_one_or_none() or 0
                if max_v >= ach.threshold_value:
                    unlocked = True

            # Track B: Artist
            elif ach.category == "SUBMISSION_COUNT":
                # Use the count on user model?
                # PRD says "total_submissions_graded" or just "Submissions".
                # Let's count actual submissions or use a counter.
                # Existing User model has `submissions` relationship.
                # Counting might be expensive if thousands.
                # We added `total_submissions_graded` to User. Let's use that or count.
                # PRD: "Discography: 50 Submissions".
                # Let's assume `total_submissions_graded` tracks this or we count.
                # `total_submissions_graded` was added. We should ensure it's updated.
                # Assuming it counts "graded" ones.
                # If the requirement is just "Submitted", we might need to count all.
                # Let's use a count query for accuracy.
                count_stmt = select(models.Submission).filter(models.Submission.user_id == user_id)
                # This counts all.
                # Optimally: select count(*)
                from sqlalchemy import func
                count_stmt = select(func.count()).select_from(models.Submission).filter(models.Submission.user_id == user_id)
                res = await db.execute(count_stmt)
                count = res.scalar() or 0
                if count >= ach.threshold_value:
                    unlocked = True

            elif ach.category == "POLL_WIN_PERCENT":
                # "Crowd Fav > 90% W Vote"
                # We need to find IF they have ANY submission with > 90% poll result.
                # Query submissions for this user where poll_result_w_percent > threshold
                stmt = select(models.Submission).filter(
                    models.Submission.user_id == user_id,
                    models.Submission.poll_result_w_percent >= ach.threshold_value
                ).limit(1)
                res = await db.execute(stmt)
                if res.scalar_one_or_none():
                    unlocked = True

            elif ach.category == "REVIEW_SCORE":
                # "Critics Choice: Perfect 10/10"
                # We check `score` column as well if `review_score` is not populated
                # PRD schema added `review_score` but logic might update `score` (float)
                # queue_service updates both `score` (float) and we mapped it.
                # Let's check `score` field since `review_score` (Decimal) was added recently
                # but `queue_service` updates `score`.
                # We should ideally check both or migrate logic.
                # For now, check `score` (Float) against threshold.
                stmt = select(models.Submission).filter(
                    models.Submission.user_id == user_id,
                    models.Submission.score >= ach.threshold_value
                ).limit(1)
                res = await db.execute(stmt)
                if res.scalar_one_or_none():
                    unlocked = True

            # Track C: Community
            elif ach.category == "DISCORD_MSG_COUNT":
                if (user.discord_msg_count or 0) >= ach.threshold_value:
                    unlocked = True
            elif ach.category == "DISCORD_VOICE_MINS":
                if (user.discord_voice_mins or 0) >= ach.threshold_value:
                    unlocked = True
            elif ach.category == "DISCORD_INVITES":
                # Not tracking invites yet in schema.
                # Placeholder.
                pass

            if unlocked:
                logger.info(f"User {user.username} unlocked {ach.display_name}!")
                new_ua = models.UserAchievement(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    achievement_id=ach.id,
                    discord_sync_status="PENDING"
                )
                db.add(new_ua)
                new_unlocks.append(new_ua)

        if new_unlocks:
            await db.commit()
            # Trigger Discord Sync (could be event based or just rely on bot polling)
            # PRD: "Bot... manage roles automatically... sync next time they login or immediate"
            # We leave status as PENDING. The Bot or a background task can pick it up.

    except Exception as e:
        logger.error(f"Error checking achievements for user {user_id}: {e}")

import uuid
