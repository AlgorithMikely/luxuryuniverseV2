
import discord
from discord.ext import commands, tasks
from sqlalchemy.orm import Session
from database import get_db
from models import DiscordUserCache
import logging

class UserCacheCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.update_user_cache.start()

    def cog_unload(self):
        self.update_user_cache.cancel()

    @tasks.loop(hours=1)
    async def update_user_cache(self):
        """Periodically fetches all members from all guilds and updates the cache."""
        logging.info("Starting user cache update...")
        db: Session = next(get_db())
        try:
            # A set to keep track of user IDs we've already processed
            processed_user_ids = set()

            all_members = list(self.bot.get_all_members())
            logging.info(f"Found {len(all_members)} total members across all guilds.")

            for member in all_members:
                if member.bot or member.id in processed_user_ids:
                    continue

                # Check if user exists
                cached_user = db.query(DiscordUserCache).filter_by(discord_id=str(member.id)).first()
                if cached_user:
                    # Update username if it has changed
                    if cached_user.username != member.name:
                        cached_user.username = member.name
                        logging.info(f"Updating username for {member.name} ({member.id})")
                else:
                    # Add new user to the cache
                    new_user = DiscordUserCache(discord_id=str(member.id), username=member.name)
                    db.add(new_user)
                    logging.info(f"Adding new user to cache: {member.name} ({member.id})")

                processed_user_ids.add(member.id)

            db.commit()
            logging.info(f"User cache update complete. Processed {len(processed_user_ids)} unique users.")

        except Exception as e:
            logging.error(f"Error updating user cache: {e}")
            db.rollback()
        finally:
            db.close()

    @update_user_cache.before_loop
    async def before_update_user_cache(self):
        await self.bot.wait_until_ready()


async def setup(bot):
    await bot.add_cog(UserCacheCog(bot))
