import discord
from discord.ext import commands, tasks
import logging
from services import user_service, achievement_service
import asyncio
from datetime import datetime, timedelta, timezone

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

                # Check "Welcome" Achievement
                if message.reference:
                    # Very basic check: replying to a "User Joined" message?
                    # Or just checking content if it contains "Welcome".
                    if "welcome" in message.content.lower():
                         await achievement_service.trigger_achievement(db, user.id, "DISCORD_WELCOME", specific_slug="welcoming_cmte")

                # Check "Broken Record" (Category E - Hidden)
                # We need to store last N messages in memory or DB.
                # For simplicity, let's use a LRU cache on the bot or cog instance.
                if not hasattr(self, 'last_messages'):
                    self.last_messages = {} # {user_id: [msg1, msg2...]}

                user_msgs = self.last_messages.get(user.id, [])
                user_msgs.append(message.content)
                if len(user_msgs) > 5:
                    user_msgs.pop(0)
                self.last_messages[user.id] = user_msgs

                if len(user_msgs) == 5 and all(m == message.content for m in user_msgs):
                     await achievement_service.trigger_achievement(db, user.id, "DISCORD_MSG_REPEAT", specific_slug="broken_record")

                await db.commit()
                # Check Achievements (Standard Message Count)
                await achievement_service.trigger_achievement(db, user.id, "DISCORD_MSG_COUNT", user.discord_msg_count)

    # --- NEW LISTENERS FOR ACHIEVEMENTS ---

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload):
        # Category D: Reactionary (500 Reacts)
        if not payload.guild_id:
            return

        async with self.bot.SessionLocal() as db:
            user = await user_service.get_user_by_discord_id(db, str(payload.user_id))
            if user:
                # We need to track total reactions. Schema doesn't have it explicitly yet.
                # We added `gamification_stats` JSON.
                stats = user.gamification_stats or {}
                # Ensure it's a dict
                if isinstance(stats, str):
                    import json
                    try: stats = json.loads(stats)
                    except: stats = {}

                current_reacts = stats.get("reactions_added", 0) + 1
                stats["reactions_added"] = current_reacts

                # Update DB
                # Force update JSON
                user.gamification_stats = dict(stats)
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(user, "gamification_stats")

                await db.commit()

                await achievement_service.trigger_achievement(db, user.id, "DISCORD_REACTION_COUNT", current_reacts)

    # --- POLL VOTING TRACKING (The Voter) ---
    # Depends on Discord.py version. Assuming 2.4+ has on_poll_vote_add?
    # checking docs... on_raw_poll_vote_add is available in newer d.py

    @commands.Cog.listener()
    async def on_raw_poll_vote_add(self, payload):
        async with self.bot.SessionLocal() as db:
             user = await user_service.get_user_by_discord_id(db, str(payload.user_id))
             if user:
                 stats = user.gamification_stats or {}
                 if isinstance(stats, str):
                    import json
                    try: stats = json.loads(stats)
                    except: stats = {}

                 current_votes = stats.get("poll_votes", 0) + 1
                 stats["poll_votes"] = current_votes

                 user.gamification_stats = dict(stats)
                 from sqlalchemy.orm.attributes import flag_modified
                 flag_modified(user, "gamification_stats")

                 await db.commit()

                 await achievement_service.trigger_achievement(db, user.id, "POLL_VOTES", current_votes)

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot:
            return

        # User joined a voice channel
        if not before.channel and after.channel:
            self.voice_sessions[member.id] = datetime.now(timezone.utc)

        # User left a voice channel
        elif before.channel and not after.channel:
            start_time = self.voice_sessions.pop(member.id, None)
            if start_time:
                now = datetime.now(timezone.utc)
                duration_seconds = (now - start_time).total_seconds()

                await self.update_user_voice_mins(member.id, int(duration_seconds / 60))

                # Check "Ghosted" (< 3 seconds)
                if duration_seconds < 3:
                     async with self.bot.SessionLocal() as db:
                         user = await user_service.get_user_by_discord_id(db, str(member.id))
                         if user:
                             await achievement_service.trigger_achievement(db, user.id, "DISCORD_VC_GHOST", specific_slug="ghosted")

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
                await achievement_service.trigger_achievement(db, user.id, "DISCORD_VOICE_MINS", user.discord_voice_mins)

    @tasks.loop(minutes=5)
    async def update_voice_minutes(self):
        """Periodic task to update voice minutes for currently active users."""
        now = datetime.now(timezone.utc)
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
