import discord
from discord.ext import commands, tasks
import logging
from services import user_service, achievement_service
import asyncio
from datetime import datetime, timedelta

class ActivityCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.voice_sessions = {} # dict[user_id, start_time]
        self.update_voice_minutes.start()

    def cog_unload(self):
        self.update_voice_minutes.cancel()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        # Increment message count
        async with self.bot.SessionLocal() as db:
            user = await user_service.get_user_by_discord_id(db, str(message.author.id))
            if user:
                user.discord_msg_count = (user.discord_msg_count or 0) + 1
                await db.commit()
                # Check Achievements
                await achievement_service.check_achievements(db, user.id, "community")

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot:
            return

        # User joined a voice channel
        if not before.channel and after.channel:
            self.voice_sessions[member.id] = datetime.utcnow()

        # User left a voice channel
        elif before.channel and not after.channel:
            start_time = self.voice_sessions.pop(member.id, None)
            if start_time:
                duration = (datetime.utcnow() - start_time).total_seconds() / 60
                await self.update_user_voice_mins(member.id, int(duration))

        # User switched channels (treat as continuous or restart? simpler to keep running unless we care about specific channels)
        # If they switch, we just keep the session going. No action needed unless we want to be very granular.

    async def update_user_voice_mins(self, discord_id: int, minutes: int):
        if minutes <= 0:
            return

        async with self.bot.SessionLocal() as db:
            user = await user_service.get_user_by_discord_id(db, str(discord_id))
            if user:
                user.discord_voice_mins = (user.discord_voice_mins or 0) + minutes
                await db.commit()
                logging.info(f"Updated voice mins for user {user.username} (+{minutes} mins)")
                # Check Achievements
                await achievement_service.check_achievements(db, user.id, "community")

    @tasks.loop(minutes=5)
    async def update_voice_minutes(self):
        """Periodic task to update voice minutes for currently active users."""
        now = datetime.utcnow()
        active_users = list(self.voice_sessions.items()) # Copy to avoid modification issues during iteration

        for user_id, start_time in active_users:
            duration = (now - start_time).total_seconds() / 60
            if duration >= 1: # Only update if at least a minute has passed
                await self.update_user_voice_mins(user_id, int(duration))
                # Reset start time to now so we don't double count
                self.voice_sessions[user_id] = now

    @update_voice_minutes.before_loop
    async def before_update_voice_minutes(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(ActivityCog(bot))
