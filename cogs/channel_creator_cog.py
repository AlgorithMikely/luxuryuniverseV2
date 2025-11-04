
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
        self.delete_removed_reviewer_channels.start()

    def cog_unload(self):
        self.create_reviewer_channels.cancel()
        self.delete_removed_reviewer_channels.cancel()

    def _get_guild(self):
        """Helper to get the guild."""
        if not self.bot.guilds:
            logging.error("Bot is not in any guilds.")
            return None
        return self.bot.guilds[0]

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

                guild = self._get_guild()
                if not guild:
                    return

                # Sanitize username for channel names
                sanitized_username = "".join(c for c in user.name if c.isalnum() or c in ('_')).lower()
                category_name = f"{sanitized_username}-reviews"

                logging.info(f"Creating channel category for {user.name}: {category_name}")

                try:
                    # Define permissions for the private channel
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        guild.me: discord.PermissionOverwrite(read_messages=True),
                        user: discord.PermissionOverwrite(read_messages=True)
                    }

                    # Create the category
                    category = await guild.create_category(category_name)

                    # Create the channels
                    submissions_channel = await category.create_text_channel("submit-music-here")
                    await category.create_text_channel("view-the-line")
                    await category.create_text_channel("files-and-links", overwrites=overwrites)

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

    @tasks.loop(minutes=5)
    async def delete_removed_reviewer_channels(self):
        """
        Periodically checks for reviewer channels that no longer have a corresponding
        reviewer in the database and deletes them.
        """
        logging.info("Checking for reviewer channels to delete...")
        guild = self._get_guild()
        if not guild:
            return

        db: Session = next(get_db())
        try:
            reviewer_channel_ids = {str(r.discord_channel_id) for r in db.query(Reviewer.discord_channel_id).all() if r.discord_channel_id}

            for category in guild.categories:
                if category.name.endswith("-reviews"):
                    # Find a submission channel to check against the DB
                    submission_channel = next((c for c in category.channels if c.name == "submit-music-here"), None)

                    if submission_channel and str(submission_channel.id) not in reviewer_channel_ids:
                        logging.info(f"Found orphaned reviewer category '{category.name}'. Deleting...")
                        try:
                            # Delete all channels in the category first
                            for channel in category.channels:
                                await channel.delete(reason="Reviewer profile removed.")
                            # Then delete the category itself
                            await category.delete(reason="Reviewer profile removed.")
                            logging.info(f"Successfully deleted category '{category.name}' and its channels.")
                        except discord.Forbidden:
                            logging.error(f"Bot lacks permission to delete channels in category '{category.name}'.")
                        except Exception as e:
                            logging.error(f"Error deleting category '{category.name}': {e}")
        except Exception as e:
            logging.error(f"Error in delete_removed_reviewer_channels loop: {e}")
        finally:
            db.close()

    @delete_removed_reviewer_channels.before_loop
    async def before_delete_removed_reviewer_channels(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(ChannelCreatorCog(bot))
