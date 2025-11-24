import logging
import uuid
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
import models

logger = logging.getLogger(__name__)

async def trigger_achievement(db: AsyncSession, user_id: int, category: str, value: int = None, specific_slug: str = None):
    """
    Checks and unlocks achievements for a given user and category.

    Args:
        db: Database session
        user_id: The ID of the user
        category: The achievement category (e.g., 'SUBMISSION_COUNT')
        value: The current metric value to check against thresholds (e.g., 50 submissions).
               If None, it implies a boolean or specific trigger where value isn't the primary check.
        specific_slug: If provided, attempts to unlock this specific achievement ID/Slug directly
                       (useful for one-off events like 'Demo Tape' logic handled externally).
    """
    try:
        user = await db.get(models.User, user_id)
        if not user:
            return

        # Fetch all definitions for this category
        stmt = select(models.AchievementDefinition).filter(models.AchievementDefinition.category == category)
        if specific_slug:
            stmt = stmt.filter(models.AchievementDefinition.slug == specific_slug)

        result = await db.execute(stmt)
        definitions = result.scalars().all()

        if not definitions:
            return

        # Fetch existing unlocks for this user to avoid duplicates
        existing_stmt = select(models.UserAchievement.achievement_id)\
            .filter(models.UserAchievement.user_id == user_id)
        existing_result = await db.execute(existing_stmt)
        unlocked_ids = set(existing_result.scalars().all())

        newly_unlocked_count = 0

        for ach in definitions:
            if ach.id in unlocked_ids:
                continue

            # Check threshold
            # If value is provided, we check if value >= threshold
            # If value is None, we assume the caller has verified the condition (e.g. specific event triggers)
            should_unlock = False
            if value is not None:
                if value >= ach.threshold_value:
                    should_unlock = True
            else:
                # If no value passed, strictly rely on specific_slug or manual logic
                if specific_slug and ach.slug == specific_slug:
                    should_unlock = True

            if should_unlock:
                logger.info(f"Unlocking achievement {ach.slug} for user {user.username}")
                user_ach = models.UserAchievement(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    achievement_id=ach.id,
                    discord_sync_status="PENDING"
                )
                db.add(user_ach)
                unlocked_ids.add(ach.id) # Add to set to prevent double unlock in same loop if duplicates exist
                newly_unlocked_count += 1

        if newly_unlocked_count > 0:
            await db.commit()

            # Recursive check for "Collector" (Total Achievements)
            # Only if we just unlocked something, to prevent infinite loops
            if category != "TOTAL_ACHIEVEMENTS":
                total_stmt = select(func.count(models.UserAchievement.id)).filter(models.UserAchievement.user_id == user_id)
                total = (await db.execute(total_stmt)).scalar()
                await trigger_achievement(db, user_id, "TOTAL_ACHIEVEMENTS", value=total)

    except Exception as e:
        logger.error(f"Error checking achievements for user {user_id}: {e}")
