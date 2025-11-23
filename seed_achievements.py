import asyncio
import uuid
from database import AsyncSessionLocal
from models import AchievementDefinition
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_achievements():
    async with AsyncSessionLocal() as db:
        # Define the achievements
        definitions = [
            # Track A: The Reviewer (Stream Growth)
            {
                "slug": "opener",
                "display_name": "The Opener",
                "description": "Reach 1,000 Total Likes on your stream.",
                "category": "LIFETIME_LIKES",
                "threshold_value": 1000,
                "discord_role_id": None
            },
            {
                "slug": "headliner",
                "display_name": "Headliner",
                "description": "Reach 100,000 Total Likes on your stream.",
                "category": "LIFETIME_LIKES",
                "threshold_value": 100000,
                "discord_role_id": None
            },
            {
                "slug": "sold_out",
                "display_name": "Sold Out",
                "description": "Reach 100 Concurrent Viewers.",
                "category": "CONCURRENT_VIEWERS",
                "threshold_value": 100,
                "discord_role_id": None
            },
            {
                "slug": "label_exec",
                "display_name": "Label Exec",
                "description": "Earn 5,000 Diamonds (Gift Value).",
                "category": "LIFETIME_DIAMONDS",
                "threshold_value": 5000,
                "discord_role_id": None
            },

            # Track B: The Artist (Submission Quality)
            {
                "slug": "demo_tape",
                "display_name": "Demo Tape",
                "description": "Submit your first track.",
                "category": "SUBMISSION_COUNT",
                "threshold_value": 1,
                "discord_role_id": None
            },
            {
                "slug": "discography",
                "display_name": "Discography",
                "description": "Submit 50 tracks.",
                "category": "SUBMISSION_COUNT",
                "threshold_value": 50,
                "discord_role_id": None
            },
            {
                "slug": "crowd_fav",
                "display_name": "Crowd Fav",
                "description": "Achieve > 90% 'W' votes on a poll.",
                "category": "POLL_WIN_PERCENT",
                "threshold_value": 90,
                "discord_role_id": None
            },
            {
                "slug": "critics_choice",
                "display_name": "Critics Choice",
                "description": "Receive a perfect 10/10 score.",
                "category": "REVIEW_SCORE",
                "threshold_value": 10,
                "discord_role_id": None
            },

            # Track C: The Community (Discord Activity)
            {
                "slug": "the_regular",
                "display_name": "The Regular",
                "description": "Send 1,000 messages in Discord.",
                "category": "DISCORD_MSG_COUNT",
                "threshold_value": 1000,
                "discord_role_id": None
            },
            {
                "slug": "studio_rat",
                "display_name": "Studio Rat",
                "description": "Spend 100 Hours in Voice Channels.",
                "category": "DISCORD_VOICE_MINS",
                "threshold_value": 6000, # 100 hours * 60 mins
                "discord_role_id": None
            },
            {
                "slug": "a_and_r",
                "display_name": "A&R",
                "description": "Invite 50 people to the server.",
                "category": "DISCORD_INVITES",
                "threshold_value": 50,
                "discord_role_id": None
            }
        ]

        try:
            from sqlalchemy import select
            for data in definitions:
                # Check if exists by slug
                result = await db.execute(select(AchievementDefinition).filter_by(slug=data["slug"]))
                exists = result.scalar_one_or_none()

                if not exists:
                    logger.info(f"Creating achievement: {data['display_name']}")
                    achievement = AchievementDefinition(
                        id=str(uuid.uuid4()),
                        slug=data["slug"],
                        display_name=data["display_name"],
                        description=data["description"],
                        category=data["category"],
                        threshold_value=data["threshold_value"],
                        discord_role_id=data["discord_role_id"]
                    )
                    db.add(achievement)
                else:
                    logger.info(f"Achievement already exists: {data['display_name']}")
                    exists.display_name = data["display_name"]
                    exists.description = data["description"]
                    exists.category = data["category"]
                    exists.threshold_value = data["threshold_value"]

            await db.commit()
            logger.info("Seeding complete.")

        except Exception as e:
            logger.error(f"Error seeding achievements: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed_achievements())
