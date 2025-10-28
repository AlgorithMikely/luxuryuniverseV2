import discord
from discord.ext import commands
import io
import yt_dlp
from services import queue_service, user_service
import event_service
import asyncio
import logging
import schemas

class PassiveSubmissionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    def _process_submission(self, author_id, author_name, author_avatar, reviewer_id, submission_url: str):
        """Synchronous function to handle blocking operations, with its own db session."""
        # Step 1: Validate the URL *before* any database operations.
        with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True}) as ydl:
            info_dict = ydl.extract_info(submission_url, download=False)
            if not info_dict:
                raise ValueError("Invalid link")

        # Step 2: If validation succeeds, then open a database session.
        with self.bot.SessionLocal() as db:
            user = user_service.get_or_create_user(db, str(author_id), author_name, str(author_avatar))

            artist = info_dict.get('artist')
            title = info_dict.get('title')

            # This is a purely synchronous call
            queue_service.create_submission(db, reviewer_id, user.id, submission_url, artist, title)

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        # We need a very short-lived session just to get the reviewer
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
            # Pass primitive types to the thread-safe function
            await asyncio.to_thread(
                self._process_submission,
                message.author.id,
                message.author.name,
                message.author.avatar,
                reviewer.id,
                submission_url
            )

            # --- All async operations happen after the blocking code is done ---
            # We need a new session for these async-context db calls
            with self.bot.SessionLocal() as db:
                # 1. Emit the queue update event
                new_queue_models = queue_service.get_pending_queue(db, reviewer.id)
                new_queue_schemas = [schemas.SubmissionDetail.from_orm(s) for s in new_queue_models]
                await event_service.emit_queue_update(reviewer.id, [s.dict() for s in new_queue_schemas])

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

        except Exception as e:
            logging.exception("An error occurred processing submission.")
            await message.add_reaction("❌")
            try:
                await message.author.send(f"Sorry, your submission in #{message.channel.name} failed: An unexpected error occurred.")
            except discord.Forbidden:
                pass

async def setup(bot):
    await bot.add_cog(PassiveSubmissionCog(bot))
