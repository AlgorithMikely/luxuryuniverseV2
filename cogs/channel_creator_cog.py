
import discord
from discord.ext import commands, tasks
from sqlalchemy.orm import Session
from database import get_db
from models import Reviewer
import logging

class ChannelCreatorCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.create_reviewer_channels.start()

    def cog_unload(self):
        self.create_reviewer_channels.cancel()

    @tasks.loop(minutes=1)
    async def create_reviewer_channels(self):
        """
        Periodically checks for new reviewers with no channel ID and creates their channels.
        """
        logging.info("Checking for new reviewers to create channels for...")
        db: Session = next(get_db())
        try:
            # Find reviewers that have been created but don't have a channel ID yet
            new_reviewers = db.query(Reviewer).filter(Reviewer.discord_channel_id == None).all()

            if not new_reviewers:
                logging.info("No new reviewers found.")
                return

            for reviewer in new_reviewers:
                user = await self.bot.fetch_user(int(reviewer.user.discord_id))
                if not user:
                    logging.warning(f"Could not find user with ID {reviewer.user.discord_id}")
                    continue

                # Assume the bot is in one guild, or you have logic to select the right one
                guild = self.bot.guilds[0]
                if not guild:
                    logging.error("Bot is not in any guilds.")
                    return

                # Sanitize username for channel names
                sanitized_username = "".join(c for c in user.name if c.isalnum() or c in ('_')).lower()
                category_name = f"{sanitized_username}-reviews"

                logging.info(f"Creating channel category for {user.name}: {category_name}")

                try:
                    # Create the category
                    category = await guild.create_category(category_name)

                    # Create the channels
                    submissions_channel = await category.create_text_channel("submit-music-here")
                    await category.create_text_channel("view-the-line")
                    await category.create_text_channel("files-and-links")

                    # Update the reviewer's profile with the new channel ID
                    reviewer.discord_channel_id = str(submissions_channel.id)
                    db.commit()

                    logging.info(f"Successfully created channels for {user.name}")
                    await submissions_channel.send(
                        f"Welcome {user.mention}! This is your new submission channel."
                    )

                except discord.Forbidden:
                    logging.error(f"Bot does not have permission to create channels in guild {guild.name}.")
                except Exception as e:
                    logging.error(f"An error occurred while creating channels for {user.name}: {e}")

        except Exception as e:
            logging.error(f"Error in create_reviewer_channels loop: {e}")
            db.rollback()
        finally:
            db.close()

    @create_reviewer_channels.before_loop
    async def before_create_reviewer_channels(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(ChannelCreatorCog(bot))
