import discord
from discord.ext import commands
import yt_dlp
from services import queue_service, user_service
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from config import settings
import logging

class PassiveSubmissionCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        if settings.SPOTIFY_CLIENT_ID and settings.SPOTIFY_CLIENT_SECRET:
            self.sp = spotipy.Spotify(
                auth_manager=SpotifyClientCredentials(
                    client_id=settings.SPOTIFY_CLIENT_ID,
                    client_secret=settings.SPOTIFY_CLIENT_SECRET
                )
            )
        else:
            self.sp = None

    async def archive_submission(self, db, user, message: discord.Message, content: str) -> str | None:
        """
        Archives the submission to the 'files-and-links' channel and returns the jump_url.
        """
        if not message.channel.category:
            return None

        files_and_links_channel = discord.utils.get(
            message.channel.category.channels, name="files-and-links"
        )

        if not files_and_links_channel:
            return None

        user_profile = user_service.get_user_by_discord_id(db, user.discord_id)
        tiktok_str = f"(TikTok: {user_profile.tiktok_username})" if user_profile and user_profile.tiktok_username else ""

        archive_message = None
        if message.attachments:
            files = [await att.to_file() for att in message.attachments]
            archive_message = await files_and_links_channel.send(
                f"Submission from {user.username} {tiktok_str}: {content}", files=files
            )
        else:
            archive_message = await files_and_links_channel.send(f"Submission from {user.username} {tiktok_str}: {content}")

        return archive_message.jump_url if archive_message else None

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        logging.info(f"Processing message from {message.author.name} in channel {message.channel.name}")

        with self.bot.SessionLocal() as db:
            reviewer = queue_service.get_reviewer_by_channel_id(db, message.channel.id)

            if not reviewer or reviewer.queue_status != "open":
                return

            logging.info(f"Found reviewer: {reviewer.user.username} for channel {message.channel.name}")

            submission_content = message.content
            is_valid = False
            track_title = None

            if "spotify.com" in submission_content and self.sp:
                try:
                    track = self.sp.track(submission_content)
                    artists = ", ".join(artist['name'] for artist in track['artists'])
                    track_title = f"{artists} - {track['name']}"
                    is_valid = True
                except Exception as e:
                    logging.error(f"Error processing Spotify link: {e}")
                    is_valid = False

            elif "http" in submission_content:
                try:
                    with yt_dlp.YoutubeDL({'quiet': True, 'extract_flat': True, 'force_generic_extractor': True}) as ydl:
                        info = ydl.extract_info(submission_content, download=False)
                        track_title = info.get('title', 'Unknown Title')
                    is_valid = True
                except yt_dlp.utils.DownloadError:
                    is_valid = False

            elif message.attachments:
                is_valid = True
                track_title = message.attachments[0].filename
                submission_content = message.attachments[0].url

            if is_valid:
                try:
                    active_session = queue_service.get_active_session_by_reviewer(db, reviewer.id)
                    if not active_session:
                        logging.warning(f"No active session found for reviewer {reviewer.user.username}. Rejecting submission.")
                        await message.reply("Sorry, the queue is currently closed because there is no active review session.")
                        return

                    logging.info(f"Found active session: {active_session.id} for reviewer: {reviewer.user.username}")

                    user = user_service.get_or_create_user(db, str(message.author.id), message.author.name)

                    logging.info(f"Processing submission for user {user.username}. Content: {submission_content}")

                    jump_url = await self.archive_submission(db, user, message, submission_content)
                    final_track_url = jump_url if message.attachments else submission_content

                    logging.info(f"Creating submission for reviewer {reviewer.id} in session {active_session.id}")
                    await queue_service.create_submission(
                        db,
                        reviewer_id=reviewer.id,
                        user_id=user.id,
                        track_url=final_track_url,
                        track_title=track_title,
                        archived_url=jump_url,
                        session_id=active_session.id
                    )
                    logging.info(f"Submission saved successfully for {user.username}. Archived URL: {jump_url}")

                    await message.delete()

                except Exception as e:
                    logging.error(f"Error processing valid submission: {e}")
                    await message.add_reaction("❌")

            else:
                try:
                    await message.add_reaction("❌")
                    await message.author.send(
                        f"Sorry, your submission in #{message.channel.name} was invalid. "
                        "Please submit a valid URL or a file attachment."
                    )
                except discord.Forbidden:
                    pass

async def setup(bot):
    await bot.add_cog(PassiveSubmissionCog(bot))
