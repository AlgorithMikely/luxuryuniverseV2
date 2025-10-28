import discord
from discord.ext import commands
import io
import yt_dlp
from services import queue_service, user_service
import asyncio

class PassiveSubmissionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    def _process_submission(self, db_session, message: discord.Message, reviewer, submission_url: str):
        """Synchronous function to handle blocking operations."""
        # Use yt-dlp to validate the URL
        with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True}) as ydl:
            info_dict = ydl.extract_info(submission_url, download=False)
            if not info_dict:
                raise ValueError("Invalid link")

        user = user_service.get_or_create_user(db_session, str(message.author.id), message.author.name, str(message.author.avatar))

        artist = info_dict.get('artist')
        title = info_dict.get('title')

        # This is now a purely synchronous call
        queue_service.create_submission(db_session, reviewer.id, user.id, submission_url, artist, title)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        with self.bot.SessionLocal() as db:
            reviewer = queue_service.get_reviewer_by_channel_id(db, message.channel.id)

            if not reviewer or reviewer.queue_status != "open":
                return

            submission_url = None
            if message.attachments:
                submission_url = message.attachments[0].url
            elif message.content:
                submission_url = message.content.strip()

            if not submission_url:
                return

            try:
                # Run the blocking code in a separate thread
                await asyncio.to_thread(self._process_submission, db, message, reviewer, submission_url)

                # --- All async operations happen after the blocking code is done ---

                # 1. Emit the queue update event
                new_queue = queue_service.get_pending_queue(db, reviewer.id)
                await self.bot.event_service.emit_queue_update(reviewer.id, [s.__dict__ for s in new_queue])

                # 2. Copy file/link to the files channel
                if reviewer.files_and_links_channel_id:
                    files_and_links_channel = self.bot.get_channel(int(reviewer.files_and_links_channel_id))
                    if files_and_links_channel:
                        if message.attachments:
                            attachment = message.attachments[0]
                            file_content = await attachment.read()
                            discord_file = discord.File(io.BytesIO(file_content), filename=attachment.filename)
                            await files_and_links_channel.send(f"Submission from {message.author.mention}:", file=discord_file)
                        else:
                            await files_and_links_channel.send(f"Submission from {message.author.mention}: {submission_url}")

                # 3. React to the original message
                await message.add_reaction("✅")

                # 4. Delete the original message
                try:
                    await message.delete()
                except discord.Forbidden:
                    print(f"Failed to delete message {message.id}: Missing 'Manage Messages' permission.")
                except discord.HTTPException as e:
                    print(f"Failed to delete message {message.id}: {e}")

            except (yt_dlp.utils.DownloadError, ValueError):
                await message.add_reaction("❌")
                try:
                    await message.author.send(f"Sorry, your submission in #{message.channel.name} failed: Invalid link.")
                except discord.Forbidden:
                    # Can't send DMs to this user
                    pass

async def setup(bot):
    await bot.add_cog(PassiveSubmissionCog(bot))
