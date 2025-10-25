import discord
from discord.ext import commands
import yt_dlp
from services import queue_service, user_service

class PassiveSubmissionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

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
            else:
                submission_url = message.content

            if not submission_url:
                return

            try:
                # Use yt-dlp to validate the URL
                with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True}) as ydl:
                    info_dict = ydl.extract_info(submission_url, download=False)
                    if not info_dict:
                        raise ValueError("Invalid link")

                user = user_service.get_or_create_user(db, str(message.author.id), message.author.name)

                if reviewer.files_and_links_channel_id:
                    files_and_links_channel = self.bot.get_channel(int(reviewer.files_and_links_channel_id))
                    if files_and_links_channel:
                        await files_and_links_channel.send(f"Submission from {message.author.mention}: {submission_url}")

                await queue_service.create_submission(db, reviewer.id, user.id, submission_url)
                await message.add_reaction("✅")
                await message.delete()

            except (yt_dlp.utils.DownloadError, ValueError):
                await message.add_reaction("❌")
                try:
                    await message.author.send(f"Sorry, your submission in #{message.channel.name} failed: Invalid link.")
                except discord.Forbidden:
                    # Can't send DMs to this user
                    pass

async def setup(bot):
    await bot.add_cog(PassiveSubmissionCog(bot))
