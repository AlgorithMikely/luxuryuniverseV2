import discord
from discord.ext import commands
from discord import app_commands
import logging
import asyncio
import time
from typing import Optional, Dict, List
from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    CommentEvent, ConnectEvent, DisconnectEvent, FollowEvent,
    GiftEvent, JoinEvent, LikeEvent, LiveEndEvent, ShareEvent, 
    RoomUserSeqEvent, WebsocketResponseEvent, RankUpdateEvent
)
from TikTokLive.client.errors import SignAPIError, UserOfflineError, UserNotFoundError
from sqlalchemy import select, update, func, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload
import os

import models
from database import AsyncSessionLocal
from services import economy_service

logger = logging.getLogger(__name__)

# Monkey patch to fix the nickName issue
try:
    from typing import Type
    from TikTokLive.proto.custom_proto import ExtendedUser
    from TikTokLive.proto.tiktok_proto import User as ProtoUser

    original_from_user = ExtendedUser.from_user

    def patched_from_user(cls: Type[ExtendedUser], user: ProtoUser) -> ExtendedUser:
        d = user.to_pydict()
        if 'nickName' in d and 'nick_name' not in d:
            d['nick_name'] = d.pop('nickName')
        if 'nickname' in d and 'nick_name' not in d:
            d['nick_name'] = d.pop('nickname')

        # Filter out unexpected keyword arguments
        import inspect
        expected_args = set(inspect.signature(cls.__init__).parameters)
        filtered_d = {k: v for k, v in d.items() if k in expected_args}

        return cls(**filtered_d)

    ExtendedUser.from_user = classmethod(patched_from_user)
    logger.info("Applied monkey patch to ExtendedUser.from_user for nickName fix.")
except Exception as e:
    logger.warning(f"Could not apply monkey patch: {e}. If errors persist, update TikTokLive library or check proto definitions.")


class TikTokCog(commands.Cog):
    """
    Manages all interactions with TikTok Live, including connection,
    event handling, and account linking.
    """
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.live_clients: Dict[str, TikTokLiveClient] = {}
        self.persistent_connections = set()

        # State for tracking song-specific interactions
        self.current_submission_id = None
        self.emoji_counts = {}
        self.viewer_count_snapshots = []
        self.comment_counts = {}
        self.comment_cooldowns = {}
        self.like_counts = {}
        self.share_counts = {}

        self.bot.loop.create_task(self.load_persistent_connections())

    def start_tracking(self, submission_id: int):
        """Start tracking interactions for a specific song."""
        self.current_submission_id = submission_id
        self.emoji_counts = {"😭": 0, "😁": 0}
        self.viewer_count_snapshots = []
        logger.info(f"Started tracking interactions for submission ID {submission_id}")

    def stop_tracking(self):
        """Stop tracking and return the collected data."""
        if not self.current_submission_id:
            return None

        logger.info(f"Stopped tracking interactions for submission ID {self.current_submission_id}")

        avg_viewers = 0
        if self.viewer_count_snapshots:
            avg_viewers = round(sum(self.viewer_count_snapshots) / len(self.viewer_count_snapshots))

        collected_data = {
            "submission_id": self.current_submission_id,
            "emoji_cry_count": self.emoji_counts.get("😭", 0),
            "emoji_grin_count": self.emoji_counts.get("😁", 0),
            "avg_viewer_count": avg_viewers
        }

        self.current_submission_id = None
        self.emoji_counts = {}
        self.viewer_count_snapshots = []

        return collected_data

    async def load_persistent_connections(self):
        await self.bot.wait_until_ready()
        logger.info("Loading persistent TikTok connections...")

        async with AsyncSessionLocal() as session:
            try:
                # Get monitored accounts
                stmt = select(models.TikTokAccount.handle_name).where(models.TikTokAccount.monitored == True)
                result = await session.execute(stmt)
                monitored_handles = result.scalars().all()

                # Get reviewer handles (equivalent to managed_categories)
                stmt_reviewers = select(models.Reviewer.tiktok_handle).where(models.Reviewer.tiktok_handle.isnot(None))
                result_reviewers = await session.execute(stmt_reviewers)
                reviewer_handles = result_reviewers.scalars().all()

                unique_handles = set(monitored_handles) | set(reviewer_handles)

                logger.info(f"Found {len(unique_handles)} handles for persistent connection: {unique_handles}")

                for handle in unique_handles:
                    if handle and handle not in self.live_clients:
                        self.persistent_connections.add(handle)
                        self.bot.loop.create_task(self._background_connect(None, handle, True))
            except Exception as e:
                logger.error(f"Error loading persistent connections: {e}", exc_info=True)

    def _setup_listeners(self, client: TikTokLiveClient, disconnect_event: asyncio.Event, session_id: Optional[int]):
        """Helper to attach all event listeners to a client instance."""

        @client.on(ConnectEvent)
        async def on_connect(event: ConnectEvent):
            logger.info(f"Successfully connected to @{client.unique_id}'s livestream!")

        @client.on(DisconnectEvent)
        async def on_disconnect(event: DisconnectEvent):
            logger.warning(f"Disconnected from @{client.unique_id}'s livestream.")
            if client.unique_id in self.persistent_connections and not disconnect_event.is_set():
                logger.info(f"Attempting to reconnect to @{client.unique_id}...")
                disconnect_event.set() 
            else:
                disconnect_event.set()

        @client.on(GiftEvent)
        async def on_gift(event: GiftEvent):
            # achievements_cog = self.bot.get_cog('AchievementsCog') # TODO: Implement AchievementsCog
            
            # If the gift is streakable and the streak is not over, wait for the final event
            if hasattr(event.gift, 'streakable') and event.gift.streakable and hasattr(event, 'streaking') and event.streaking:
                return

            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)
            
            async with AsyncSessionLocal() as session:
                try:
                    tiktok_account = await self.get_or_create_tiktok_account(session, user_handle)
                    points = event.gift.diamond_count * 2 if event.gift.diamond_count < 1000 else event.gift.diamond_count
                    await self.award_points(session, tiktok_account.id, points)
                    logger.info(f"{user_handle} sent a {event.gift.name} gift worth {event.gift.diamond_count} diamonds.")

                    # Award Luxury Coins if the host has the feature enabled
                    # Check if host is a reviewer
                    stmt = select(models.Reviewer).where(models.Reviewer.tiktok_handle == client.unique_id)
                    result = await session.execute(stmt)
                    reviewer = result.scalar_one_or_none()

                    if reviewer and tiktok_account.user_id: # linked_discord_id is user_id in TikTokAccount model
                        # 2 coins per $1, and TikTok's rate is roughly $0.01 per diamond. So 2 coins per 100 diamonds.
                        luxury_coins_awarded = (event.gift.diamond_count // 50) * 1 
                        reason = f"TikTok Gift from @{user_handle} to @{client.unique_id}"
                        await self.award_luxury_coins(session, tiktok_account.user_id, luxury_coins_awarded, reviewer.id, reason)

                    # Log interaction
                    interaction_value = f"Gift: {event.gift.name}, Value: {event.gift.diamond_count}"
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='GIFT',
                        value=interaction_value,
                        coin_value=event.gift.diamond_count,
                        user_level=user_level
                    )
                    session.add(interaction)
                    await session.commit()

                    # TODO: Achievements logic (First Offering, High Roller, The Patron)

                except Exception as e:
                    logger.error(f"Error processing gift event: {e}", exc_info=True)

        @client.on(LikeEvent)
        async def on_like(event: LikeEvent):
            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)

            async with AsyncSessionLocal() as session:
                try:
                    tiktok_account = await self.get_or_create_tiktok_account(session, user_handle)
                    await self.award_points(session, tiktok_account.id, event.count)
                    logger.info(f"{user_handle} liked the stream {event.count} times.")

                    # Award luxury coins for likes
                    await self._award_coins_for_interaction(session, client.unique_id, tiktok_account, 'LIKE', event.count)

                    # Log interaction
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='LIKE',
                        value=str(event.count),
                        user_level=user_level
                    )
                    session.add(interaction)
                    await session.commit()

                except Exception as e:
                    logger.error(f"Error processing like event: {e}", exc_info=True)

        @client.on(ShareEvent)
        async def on_share(event: ShareEvent):
            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)

            async with AsyncSessionLocal() as session:
                try:
                    tiktok_account = await self.get_or_create_tiktok_account(session, user_handle)
                    await self.award_points(session, tiktok_account.id, 5)
                    logger.info(f"{user_handle} shared the stream.")

                    # Award luxury coins for shares
                    await self._award_coins_for_interaction(session, client.unique_id, tiktok_account, 'SHARE')

                    # Log interaction
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='SHARE',
                        value='1',
                        user_level=user_level
                    )
                    session.add(interaction)
                    await session.commit()

                except Exception as e:
                    logger.error(f"Error processing share event: {e}", exc_info=True)

        @client.on(CommentEvent)
        async def on_comment(event: CommentEvent):
            if self.current_submission_id:
                comment = event.comment.strip()
                if comment == "😭" or comment == "😁":
                    if comment == "😭":
                        self.emoji_counts["😭"] += 1
                    else:
                        self.emoji_counts["😁"] += 1
                    
                    # TODO: Record vote for Super-Fan achievement (user_poll_votes table missing)

            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)

            async with AsyncSessionLocal() as session:
                try:
                    tiktok_account = await self.get_or_create_tiktok_account(session, user_handle)
                    await self.award_points(session, tiktok_account.id, 1)
                    logger.info(f"{user_handle}: {event.comment}")

                    # Award luxury coins for comments
                    await self._award_coins_for_interaction(session, client.unique_id, tiktok_account, 'COMMENT')

                    # Log interaction
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='COMMENT',
                        value=event.comment,
                        user_level=user_level
                    )
                    session.add(interaction)
                    await session.commit()

                    # TODO: Chatterbox achievements

                except Exception as e:
                    logger.error(f"Error processing comment event: {e}", exc_info=True)

        @client.on(LiveEndEvent)
        async def on_live_end(event: LiveEndEvent):
            try:
                logger.info(f"@{client.unique_id}'s livestream has ended. Processing end-of-session achievements.")
                
                async with AsyncSessionLocal() as session:
                    # Log the live end event
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        host_handle=client.unique_id,
                        interaction_type='LIVE_END',
                        value='1'
                    )
                    session.add(interaction)
                    await session.commit()

                    # TODO: "The Judge" achievement logic

            except Exception as e:
                logger.error(f"Error processing live end event: {e}", exc_info=True)
            finally:
                disconnect_event.set()

        @client.on(JoinEvent)
        async def on_join(event: JoinEvent):
            try:
                logger.info(f"{event.user.unique_id} joined the stream.")
                async with AsyncSessionLocal() as session:
                    tiktok_account = await self.get_or_create_tiktok_account(session, event.user.unique_id)
                    
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='JOIN',
                        value='1',
                        user_level=getattr(event.user, 'level', 0)
                    )
                    session.add(interaction)
                    await session.commit()

                    # TODO: Attendance achievements (Grand Entrance, Iron Fan, etc.)

            except Exception as e:
                logger.error(f"Error processing join event: {e}", exc_info=True)

        @client.on(FollowEvent)
        async def on_follow(event: FollowEvent):
            try:
                logger.info(f"{event.user.unique_id} followed the host.")
                async with AsyncSessionLocal() as session:
                    tiktok_account = await self.get_or_create_tiktok_account(session, event.user.unique_id)
                    
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        tiktok_account_id=tiktok_account.id,
                        host_handle=client.unique_id,
                        interaction_type='FOLLOW',
                        value='1',
                        user_level=getattr(event.user, 'level', 0)
                    )
                    session.add(interaction)
                    await session.commit()
            except Exception as e:
                logger.error(f"Error processing follow event: {e}", exc_info=True)

        @client.on(RoomUserSeqEvent)
        async def on_viewer_count_update(event: RoomUserSeqEvent):
            if self.current_submission_id:
                self.viewer_count_snapshots.append(event.m_total)

            try:
                logger.info(f"Viewer count updated to {event.m_total} (total_user: {event.total_user}).")
                async with AsyncSessionLocal() as session:
                    # Note: TikTokInteraction model might not have total_viewer_count column based on models.py review
                    # models.py shows: value, coin_value, user_level. No total_viewer_count.
                    # We will store it in 'value' as JSON or string.
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        host_handle=client.unique_id,
                        interaction_type='VIEWER_COUNT_UPDATE',
                        value=str(event.m_total), # Storing viewer count in value
                        # total_viewer_count=event.total_user # This column likely doesn't exist in current models.py
                    )
                    session.add(interaction)
                    await session.commit()
            except Exception as e:
                logger.error(f"Error processing viewer count update event: {e}", exc_info=True)

        @client.on(RankUpdateEvent)
        async def on_rank_update(event: RankUpdateEvent):
            try:
                if event.ranks:
                    async with AsyncSessionLocal() as session:
                        for rank in event.ranks:
                            update_entry = models.TikTokRankUpdate(
                                session_id=session_id,
                                tiktok_user_id=rank.user_id, # Ensure this maps correctly
                                rank=rank.rank,
                                score=rank.score,
                                delta=rank.delta
                            )
                            session.add(update_entry)
                        await session.commit()
            except Exception as e:
                logger.error(f"Error processing rank update event: {e}", exc_info=True)

    async def get_or_create_tiktok_account(self, session: AsyncSession, handle_name: str) -> models.TikTokAccount:
        stmt = select(models.TikTokAccount).where(models.TikTokAccount.handle_name == handle_name)
        result = await session.execute(stmt)
        account = result.scalar_one_or_none()
        
        if account:
            return account
            
        stmt = pg_insert(models.TikTokAccount).values(
            handle_name=handle_name,
            points=0,
            monitored=False
        ).on_conflict_do_nothing(
            index_elements=[models.TikTokAccount.handle_name]
        )
        await session.execute(stmt)
        
        # Re-fetch
        stmt = select(models.TikTokAccount).where(models.TikTokAccount.handle_name == handle_name)
        result = await session.execute(stmt)
        return result.scalar_one()

    async def award_points(self, session: AsyncSession, handle_id: int, points: int):
        stmt = update(models.TikTokAccount).where(models.TikTokAccount.id == handle_id).values(points=models.TikTokAccount.points + points)
        await session.execute(stmt)
        await session.commit()

    async def _award_coins_for_interaction(self, session: AsyncSession, host_handle: str, tiktok_account: models.TikTokAccount, interaction_type: str, count: int = 1):
        """
        Awards luxury coins for TikTok interactions if the host has the feature enabled.
        """
        if not tiktok_account or not tiktok_account.user_id:
            return

        user_id = tiktok_account.user_id
        user_handle = tiktok_account.handle_name

        # 1. Check if the host has coin rewards enabled (Check Reviewer existence)
        stmt = select(models.Reviewer).where(models.Reviewer.tiktok_handle == host_handle)
        result = await session.execute(stmt)
        reviewer = result.scalar_one_or_none()
        
        if not reviewer:
            return

        # 2. Determine the coin value and tracking dictionary
        rules = {
            'LIKE': {'threshold': 300, 'coins': 1, 'tracker': self.like_counts},
            'COMMENT': {'threshold': 300, 'coins': 1, 'tracker': self.comment_counts},
            'SHARE': {'threshold': 100, 'coins': 1, 'tracker': self.share_counts}
        }

        if interaction_type not in rules:
            return

        rule = rules[interaction_type]
        tracker = rule['tracker']
        threshold = rule['threshold']
        coins_per_threshold = rule['coins']

        # 3. Update and check the user's interaction count
        current_count = tracker.get(user_handle, 0) + count
        coins_to_award = (current_count // threshold) * coins_per_threshold
        tracker[user_handle] = current_count % threshold  # Keep the remainder

        # 4. Award coins if the threshold was met
        if coins_to_award > 0:
            reason = f"TikTok {interaction_type.title()} interaction with @{host_handle}"
            await self.award_luxury_coins(session, user_id, coins_to_award, reviewer.id, reason)

    async def award_luxury_coins(self, session: AsyncSession, user_id: int, amount: int, reviewer_id: int, reason: str = "TikTok gift rewards"):
        # Use economy_service directly instead of Cog lookup to avoid circular deps or context issues
        try:
            await economy_service.add_coins(
                session,
                reviewer_id=reviewer_id,
                user_id=user_id,
                amount=amount,
                reason=reason
            )
            logger.info(f"Awarded {amount} coins to user {user_id} for {reason} (Reviewer: {reviewer_id})")
        except Exception as e:
            logger.error(f"Error awarding luxury coins: {e}")

    async def _perform_link_account(self, interaction: discord.Interaction, handle: str) -> tuple[bool, str]:
        """Performs the logic of linking a TikTok account and returns a status message."""
        handle = handle.replace('@', '').lower()
        user_id = interaction.user.id

        async with AsyncSessionLocal() as session:
            # 1. Check if the handle exists
            stmt = select(models.TikTokAccount).where(models.TikTokAccount.handle_name == handle)
            result = await session.execute(stmt)
            account = result.scalar_one_or_none()

            if not account:
                return False, (
                    f"❌ **TikTok handle not found.**\n"
                    f"The handle `@{handle}` hasn't been seen by the bot yet. "
                    f"Please join the live stream and interact (e.g., like, comment, or share) "
                    f"so the bot can register your account, then try this command again."
                )

            # 2. Check if linked
            if account.user_id and account.user_id != user_id:
                # Note: account.user_id maps to models.User.id, not Discord ID directly. 
                # But models.User has discord_id.
                # We need to check if the linked user_id corresponds to another discord user.
                # For simplicity, we assume strict 1-to-1 mapping if set.
                return False, f"❌ That TikTok handle is already linked to another Discord user."

            # 3. Link
            # Find the User record for this discord_id
            stmt_user = select(models.User).where(models.User.discord_id == str(user_id))
            result_user = await session.execute(stmt_user)
            user = result_user.scalar_one_or_none()
            
            if not user:
                # Create user if not exists? Or fail?
                # Usually user should exist if they are interacting.
                return False, "❌ You are not registered in the system."

            account.user_id = user.id
            await session.commit()
            
            # Backfill submissions
            stmt_sub = update(models.Submission).where(
                models.Submission.user_id == user.id,
                (models.Submission.tiktok_username == None) | (models.Submission.tiktok_username == '')
            ).values(tiktok_username=handle)
            result_sub = await session.execute(stmt_sub)
            update_count = result_sub.rowcount
            await session.commit()

        response_message = f"✅ Your Discord account has been successfully linked to the TikTok handle **@{handle}**."
        if update_count > 0:
            response_message += f"\nUpdated {update_count} of your past submissions with this handle."

        # Trigger embed refresh (if cog exists)
        embed_cog = self.bot.get_cog('EmbedRefreshCog')
        if embed_cog:
            embed_cog.trigger_update()

        # TODO: Achievement "On the List"

        return True, response_message

    async def _background_connect(self, interaction: Optional[discord.Interaction], unique_id: str, persistent: bool):
        """A background task to handle the TikTok connection lifecycle."""
        disconnect_event = asyncio.Event()
        max_retries = 3
        session_id = None
        
        unique_id = unique_id.replace('@', '').lower()
        
        try:
            for attempt in range(max_retries):
                try:
                    async with AsyncSessionLocal() as session:
                        # Get active session
                        stmt = select(models.ReviewSession).join(models.Reviewer).where(
                            models.Reviewer.tiktok_handle == unique_id,
                            models.ReviewSession.is_active == True
                        ).order_by(desc(models.ReviewSession.created_at)).limit(1)
                        result = await session.execute(stmt)
                        active_session = result.scalar_one_or_none()
                        
                        if active_session:
                            session_id = active_session.id
                            logger.info(f"Attempting to connect to @{unique_id} using active session {session_id}")
                        else:
                            logger.info(f"Attempting to connect to @{unique_id} without an active session.")

                    client = TikTokLiveClient(unique_id=f"@{unique_id}")
                    self._setup_listeners(client, disconnect_event, session_id)

                    self.live_clients[unique_id] = client
                    if persistent:
                        self.persistent_connections.add(unique_id)

                    await client.start()

                    # Wait until the disconnect event is set
                    await disconnect_event.wait()

                    logger.info(f"Disconnect event received for @{unique_id}. Proceeding with cleanup.")
                    break  # Exit the retry loop

                except UserNotFoundError:
                    logger.warning(f"Connection attempt failed for @{unique_id}: User not found.")
                    if interaction:
                        await interaction.followup.send(f"❌ **User Not Found:** Could not connect to @{unique_id}.", ephemeral=True)
                    break

                except UserOfflineError:
                    logger.info(f"Connection attempt failed for @{unique_id} because the user is offline.")
                    if interaction:
                        await interaction.followup.send(f"❌ **User Offline:** Could not connect to @{unique_id}.", ephemeral=True)
                    break

                except SignAPIError as e:
                    logger.warning(f"Sign API Error connecting to @{unique_id}: {e}")
                    if interaction:
                        await interaction.followup.send(f"❌ **Sign API Error:** Could not connect to @{unique_id}. Please try again later.", ephemeral=True)
                    break

                except Exception as e:
                    logger.error(f"Error connecting to @{unique_id}: {e}", exc_info=True)
                    if attempt < max_retries - 1:
                        logger.info(f"Retrying connection to @{unique_id} in 5 seconds...")
                        await asyncio.sleep(5)
                    else:
                        logger.error(f"Failed to connect to @{unique_id} after {max_retries} attempts.")
                        if interaction:
                            await interaction.followup.send(f"❌ **Connection Failed:** Could not connect to @{unique_id} after multiple attempts.", ephemeral=True)
        finally:
            if unique_id in self.live_clients:
                del self.live_clients[unique_id]
            if persistent and unique_id in self.persistent_connections:
                self.persistent_connections.remove(unique_id)

    @app_commands.command(name="tiktok_status", description="Check the status of TikTok Live connections")
    async def tiktok_status(self, interaction: discord.Interaction):
        if not self.live_clients:
            await interaction.response.send_message("No active TikTok Live connections.", ephemeral=True)
            return

        status_msg = "**Active TikTok Live Connections:**\n"
        for handle, client in self.live_clients.items():
            status_msg += f"- **@{handle}**: Connected (Room ID: {client.room_id})\n"

        await interaction.response.send_message(status_msg, ephemeral=True)

    @app_commands.command(name="link_tiktok", description="Link your TikTok account to your Discord profile")
    async def link_tiktok(self, interaction: discord.Interaction, handle: str):
        await interaction.response.defer(ephemeral=True)
        success, message = await self._perform_link_account(interaction, handle)
        await interaction.followup.send(message, ephemeral=True)

    @app_commands.command(name="connect_tiktok", description="Manually connect to a TikTok Live stream")
    async def connect_tiktok(self, interaction: discord.Interaction, handle: str):
        """Manually connect to a TikTok Live stream."""
        await interaction.response.defer(ephemeral=True)
        
        handle = handle.replace('@', '').lower()
        
        if handle in self.live_clients:
            await interaction.followup.send(f"⚠️ Already connected to **@{handle}**.", ephemeral=True)
            return

        # Start background connection task
        # We pass persistent=False because manual connections might not be intended to auto-reconnect forever 
        # unless added to the monitored list. But for now, let's assume manual = temporary unless monitored.
        # Actually, if the user manually connects, they probably want it to work.
        self.bot.loop.create_task(self._background_connect(interaction, handle, persistent=False))
        
        # _background_connect handles the success/failure messages via interaction.followup if provided.
        # The current implementation of _background_connect uses interaction.followup.send if interaction is not None.
        # So we are good.

    @app_commands.command(name="disconnect_tiktok", description="Disconnect from a TikTok Live stream")
    async def disconnect_tiktok(self, interaction: discord.Interaction, handle: str):
        """Disconnect from a TikTok Live stream."""
        await interaction.response.defer(ephemeral=True)
        
        handle = handle.replace('@', '').lower()
        
        if handle not in self.live_clients:
            await interaction.followup.send(f"❌ Not currently connected to **@{handle}**.", ephemeral=True)
            return

        try:
            client = self.live_clients[handle]
            await client.stop()
            
            if handle in self.live_clients:
                del self.live_clients[handle]
            
            if handle in self.persistent_connections:
                self.persistent_connections.remove(handle)
                
            await interaction.followup.send(f"✅ Disconnected from **@{handle}**.", ephemeral=True)
        except Exception as e:
            logger.error(f"Error disconnecting from @{handle}: {e}", exc_info=True)
            await interaction.followup.send(f"❌ Error disconnecting from **@{handle}**: {e}", ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(TikTokCog(bot))