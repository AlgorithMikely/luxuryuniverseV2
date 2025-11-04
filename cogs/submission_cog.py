import discord
from discord.ext import commands
import yt_dlp
from services import queue_service, user_service

import logging

class PassiveSubmissionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def archive_submission(self, message: discord.Message, content: str):
        """Finds the files-and-links channel and sends the submission content."""
        if not message.channel.category:
            return

        files_and_links_channel = discord.utils.get(
            message.channel.category.channels, name="files-and-links"
        )

        if files_and_links_channel:
            user = message.author
            tiktok_handle = user_service.get_user_by_discord_id(self.bot.SessionLocal(), str(user.id))
            tiktok_str = f"(TikTok: {tiktok_handle.tiktok_username})" if tiktok_handle and tiktok_handle.tiktok_username else ""

            # Handle file attachments
            if message.attachments:
                files = [await att.to_file() for att in message.attachments]
                await files_and_links_channel.send(
                    f"Submission from {user.name} {tiktok_str}: {content}", files=files
                )
            else:
                await files_and_links_channel.send(f"Submission from {user.name} {tiktok_str}: {content}")

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        # Use a context manager for the database session
        with self.bot.SessionLocal() as db:
            reviewer = queue_service.get_reviewer_by_channel_id(db, message.channel.id)

            # We only care about messages in reviewer channels where the queue is open
            if not reviewer or reviewer.queue_status != "open":
                return

            submission_content = message.content
            is_valid = False

            # --- Validation ---
            # 1. Check for URL
            if "http" in submission_content:
                try:
                    with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True}) as ydl:
                        ydl.extract_info(submission_content, download=False)
                    is_valid = True
                except yt_dlp.utils.DownloadError:
                    is_valid = False # Invalid URL

            # 2. Check for attachments if no valid URL was found
            elif message.attachments:
                is_valid = True
                # Use the attachment URL if available, otherwise just use the message content
                submission_content = message.attachments[0].url

            # --- Process Valid Submission ---
            if is_valid:
                try:
                    user = user_service.get_or_create_user(db, str(message.author.id), message.author.name)
                    await queue_service.create_submission(db, reviewer.id, user.id, submission_content)

                    # Archive and delete
                    await self.archive_submission(message, submission_content)
                    await message.delete()

                except Exception as e:
                    logging.error(f"Error processing valid submission: {e}")
                    await message.add_reaction("❌") # Internal error

            # --- Handle Invalid Submission ---
            else:
                try:
                    await message.add_reaction("❌")
                    await message.author.send(
                        f"Sorry, your submission in #{message.channel.name} was invalid. "
                        "Please submit a valid URL or a file attachment."
                    )
                except discord.Forbidden:
                    pass # Can't send DMs

async def setup(bot):
    await bot.add_cog(PassiveSubmissionCog(bot))
