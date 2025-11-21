import discord
from discord.ext import commands, tasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
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
        Also verifies that existing channel IDs in the DB actually exist in Discord.
        """
        logging.info("Checking for new reviewers to create channels for...")

        # Use async for to handle the async generator
        async for db in get_db():
            try:
                # 1. Check for Reviewers with NO channel ID (New Reviewers)
                stmt = select(Reviewer).options(selectinload(Reviewer.user)).filter(Reviewer.discord_channel_id == None)
                result = await db.execute(stmt)
                new_reviewers = result.scalars().all()

                # 2. Check for Reviewers WITH channel ID (Verify Existence)
                stmt_existing = select(Reviewer).options(selectinload(Reviewer.user)).filter(Reviewer.discord_channel_id != None)
                result_existing = await db.execute(stmt_existing)
                existing_reviewers = result_existing.scalars().all()

                # Combine lists to process
                all_reviewers_to_check = list(new_reviewers) + list(existing_reviewers)

                if not all_reviewers_to_check:
                    logging.info("No reviewers found to check.")
                    return

                guild = self._get_guild()
                if not guild:
                    return

                for reviewer in all_reviewers_to_check:
                    # access reviewer.user safely because of selectinload
                    user = await self.bot.fetch_user(int(reviewer.user.discord_id))
                    if not user:
                        logging.warning(f"Could not find user with ID {reviewer.user.discord_id}")
                        continue

                    # Check if channel exists if ID is present
                    # Check if channel exists if ID is present
                    if reviewer.discord_channel_id:
                        channel = guild.get_channel(int(reviewer.discord_channel_id))
                        if not channel:
                            try:
                                # Fallback to API fetch to be sure it's not just a cache miss
                                channel = await guild.fetch_channel(int(reviewer.discord_channel_id))
                            except discord.NotFound:
                                channel = None
                            except discord.Forbidden:
                                logging.warning(f"Bot lacks permission to view channel {reviewer.discord_channel_id} for {user.name}")
                                continue
                            except Exception as e:
                                logging.error(f"Error fetching channel {reviewer.discord_channel_id}: {e}")
                                continue
                        if channel:
                            # Channel exists, all good
                            logging.info(f"Channel {channel.id} verified for {user.name}")
                            continue
                        else:
                            # CRITICAL FIX: Do NOT recreate if ID exists but channel not found.
                            # This prevents the "deleting and restoring" loop if the bot just can't see it.
                            logging.error(f"Channel {reviewer.discord_channel_id} for {user.name} NOT FOUND (ID exists in DB). Stopping to prevent recreation loop. Please check permissions or clear DB ID manually.")
                            continue 

                    # --- Creation Logic ---
                    # Only runs if reviewer.discord_channel_id was None initially
                    
                    # Sanitize username for channel names
                    sanitized_username = "".join(c for c in user.name if c.isalnum() or c in ('_')).lower()
                    category_name = f"{sanitized_username}-reviews"

                    logging.info(f"Creating/Finding channel category for {user.name}: {category_name}")

                    try:
                        # Define permissions for the private channel
                        overwrites = {
                            guild.default_role: discord.PermissionOverwrite(read_messages=False),
                            guild.me: discord.PermissionOverwrite(read_messages=True),
                            user: discord.PermissionOverwrite(read_messages=True)
                        }

                        # Check if category already exists
                        category = discord.utils.get(guild.categories, name=category_name)
                        
                        submissions_channel = None
                        if category:
                            logging.info(f"Found existing category: {category.name} ({category.id})")
                            submissions_channel = discord.utils.get(category.text_channels, name="submit-music-here")
                            if submissions_channel:
                                logging.info(f"Found existing submissions channel: {submissions_channel.name} ({submissions_channel.id})")
                        else:
                            # Create the category
                            logging.info(f"Category {category_name} not found. Creating new category.")
                            category = await guild.create_category(category_name)

                        if not submissions_channel:
                            # Create the channels if they don't exist
                            logging.info(f"Submissions channel not found in {category.name}. Creating new channels.")
                            submissions_channel = await category.create_text_channel("submit-music-here")
                            await category.create_text_channel("view-the-line")
                            await category.create_text_channel("files-and-links", overwrites=overwrites)
                            
                            await submissions_channel.send(
                                f"Welcome {user.mention}! This is your new submission channel."
                            )
                        else:
                             logging.info(f"Using existing submissions channel: {submissions_channel.id}")

                        # Update the reviewer's profile with the new channel ID
                        reviewer.discord_channel_id = str(submissions_channel.id)
                        await db.commit() # Async commit

                        logging.info(f"Successfully linked channels for {user.name} to ID {submissions_channel.id}")

                    except discord.Forbidden:
                        logging.error(f"Bot does not have permission to create channels in guild {guild.name}.")
                    except Exception as e:
                        logging.error(f"An error occurred while creating channels for {user.name}: {e}")
                        await db.rollback()

            except Exception as e:
                logging.error(f"Error in create_reviewer_channels loop: {e}")
                await db.rollback() # Async rollback

            # Return to exit the loop and close the session
            return

    @create_reviewer_channels.before_loop
    async def before_create_reviewer_channels(self):
        await self.bot.wait_until_ready()

    @tasks.loop(minutes=5)
    async def delete_removed_reviewer_channels(self):
        """
        Periodically checks for reviewer channels that no longer have a corresponding
        reviewer in the database and deletes them.
        """
        # PERMANENTLY DISABLED: To prevent accidental deletion of channels.
        # The bot should not delete channels automatically.
        pass

    @delete_removed_reviewer_channels.before_loop
    async def before_delete_removed_reviewer_channels(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(ChannelCreatorCog(bot))
