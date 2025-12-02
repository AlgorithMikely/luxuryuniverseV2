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
from services import economy_service, user_service, giveaway_service, queue_service, achievement_service
from services import broadcast as broadcast_service

logger = logging.getLogger(__name__)

# Monkey patch to fix the nickName issue and map camelCase keys
try:
    from typing import Type
    from TikTokLive.proto.custom_proto import ExtendedUser
    from TikTokLive.proto.tiktok_proto import User as ProtoUser

    original_from_user = ExtendedUser.from_user

    def patched_from_user(cls: Type[ExtendedUser], user: ProtoUser) -> ExtendedUser:
        d = user.to_pydict()
        
        # Mapping of camelCase to snake_case for critical fields
        key_mapping = {
            'nickName': 'nick_name',
            'badgeList': 'badge_list',
            'userBadges': 'user_badges',
            'isFollower': 'is_follower',
            'isSubscribe': 'is_subscribe',
            'topVipNo': 'top_vip_no',
            'userRole': 'user_role',
            'displayId': 'display_id',
            'secUid': 'sec_uid',
            'payScore': 'pay_score',
            'fanTicketCount': 'fan_ticket_count',
            'anchorLevel': 'anchor_level',
            'verifiedContent': 'verified_content',
            'authorInfo': 'author_info',
            'topFans': 'top_fans',
            'rewardInfo': 'reward_info',
            'personalCard': 'personal_card',
            'authenticationInfo': 'authentication_info',
            'mediaBadgeImageList': 'media_badge_image_list',
            'commerceWebcastConfigIds': 'commerce_webcast_config_ids',
            'comboBadgeInfo': 'combo_badge_info',
            'subscribeInfo': 'subscribe_info',
            'mintTypeLabel': 'mint_type_label',
            'fansClubInfo': 'fans_club_info',
            'allowFindByContacts': 'allow_find_by_contacts',
            'allowOthersDownloadVideo': 'allow_others_download_video',
            'allowOthersDownloadWhenSharingVideo': 'allow_others_download_when_sharing_video',
            'allowShareShowProfile': 'allow_share_show_profile',
            'allowShowInGossip': 'allow_show_in_gossip',
            'allowShowMyAction': 'allow_show_my_action',
            'allowStrangeComment': 'allow_strange_comment',
            'allowUnfollowerComment': 'allow_unfollower_comment',
            'allowUseLinkmic': 'allow_use_linkmic',
            'avatarJpg': 'avatar_jpg',
            'backgroundImgUrl': 'background_img_url',
            'blockStatus': 'block_status',
            'commentRestrict': 'comment_restrict',
            'disableIchat': 'disable_ichat',
            'enableIchatImg': 'enable_ichat_img',
            'foldStrangerChat': 'fold_stranger_chat',
            'followStatus': 'follow_status',
            'ichatRestrictType': 'ichat_restrict_type',
            'idStr': 'id_str',
            'isFollowing': 'is_following',
            'needProfileGuide': 'need_profile_guide',
            'pushCommentStatus': 'push_comment_status',
            'pushDigg': 'push_digg',
            'pushFollow': 'push_follow',
            'pushFriendAction': 'push_friend_action',
            'pushIchat': 'push_ichat',
            'pushStatus': 'push_status',
            'pushVideoPost': 'push_video_post',
            'pushVideoRecommend': 'push_video_recommend',
            'verifiedReason': 'verified_reason',
            'enableCarManagementPermission': 'enable_car_management_permission',
            'upcomingEventList': 'upcoming_event_list',
            'scmLabel': 'scm_label',
            'ecommerceEntrance': 'ecommerce_entrance',
            'isBlock': 'is_block',
            'isAnchorMarked': 'is_anchor_marked'
        }

        for camel, snake in key_mapping.items():
            if camel in d and snake not in d:
                d[snake] = d.pop(camel)

        # Filter out unexpected keyword arguments
        import inspect
        expected_args = set(inspect.signature(cls.__init__).parameters)
        filtered_d = {k: v for k, v in d.items() if k in expected_args}
        
        return cls(**filtered_d)

    ExtendedUser.from_user = classmethod(patched_from_user)
    logger.info("Applied monkey patch to ExtendedUser.from_user for nickName fix.")
except Exception as e:
    logger.warning(f"Could not apply monkey patch: {e}. If errors persist, update TikTokLive library or check proto definitions.")

# Buffer State
class StreamBuffer:
    def __init__(self):
        self.current_session_likes = 0
        self.current_session_diamonds = 0
        self.viewer_count_samples = []
        self.viewer_count_sum = 0
        self.poll_wins = 0
        self.active_submission_id = None

        # Poll Fallback
        self.emoji_smile_count = 0
        self.emoji_cry_count = 0

        # Chat Activity for Achievements
        # Structure: {tiktok_user_id: { 'rainbow': set(), 'all_caps': bool, 'emoji_only': bool, 'likes_sent': int, 'gifts_sent': int, 'msg_count': int, 'shares_sent': int }}
        self.user_chat_activity = {}

    def add_likes(self, count: int):
        self.current_session_likes += count

    def add_diamonds(self, count: int):
        self.current_session_diamonds += count

    def add_viewer_sample(self, count: int):
        self.viewer_count_samples.append(count)
        self.viewer_count_sum += count

    def add_emoji_vote(self, is_positive: bool):
        if is_positive:
            self.emoji_smile_count += 1
        else:
            self.emoji_cry_count += 1

    def get_average_viewers(self) -> int:
        if not self.viewer_count_samples:
            return 0
        return int(self.viewer_count_sum / len(self.viewer_count_samples))

    def get_poll_win_percent(self) -> int | None:
        total = self.emoji_smile_count + self.emoji_cry_count
        if total == 0:
            return None
        return int((self.emoji_smile_count / total) * 100)

    def reset(self):
        # Reset flushed metrics
        self.current_session_likes = 0
        self.current_session_diamonds = 0
        self.emoji_smile_count = 0
        self.emoji_cry_count = 0
        self.user_chat_activity = {}
        # Don't reset viewer samples entirely if we want to calc avg over the submission duration?
        # For simplicity, we flush the window and reset.
        pass

class TikTokCog(commands.Cog):
    """
    Manages all interactions with TikTok Live, including connection,
    event handling, and account linking.
    """
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.live_clients: Dict[str, TikTokLiveClient] = {}
        self.persistent_connections = set()
        
        # Community Goal / Reviewer Logic
        self.reviewer_map = {} # handle -> reviewer_id
        self.buffers = {} # handle -> StreamBuffer
        self.flush_tasks = {} # handle -> task

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

    async def update_monitoring(self, handle: str, monitored: bool):
        """
        Updates the monitoring status for a handle.
        If monitored is True, adds to persistent connections and connects if not already connected.
        If monitored is False, removes from persistent connections and disconnects.
        """
        handle = handle.replace('@', '').lower()
        logger.info(f"Updating monitoring for @{handle} to {monitored}")

        if monitored:
            self.persistent_connections.add(handle)
            if handle not in self.live_clients:
                self.bot.loop.create_task(self._background_connect(None, handle, True))
        else:
            if handle in self.persistent_connections:
                self.persistent_connections.remove(handle)
            
            # Disconnect if currently connected
            if handle in self.live_clients:
                await self.disconnect_account(handle)

    async def disconnect_account(self, handle: str) -> bool:
        """
        Disconnects a specific TikTok account and removes it from persistent connections.
        Returns True if successful (or if not connected), False if error.
        """
        handle = handle.replace('@', '').lower()
        logger.info(f"Attempting to disconnect @{handle}...")

        # Remove from persistent connections first to prevent auto-reconnect
        if handle in self.persistent_connections:
            self.persistent_connections.remove(handle)
            logger.info(f"Removed @{handle} from persistent connections.")

        # Cleanup flush task
        if handle in self.flush_tasks:
            self.flush_tasks[handle].cancel()
            del self.flush_tasks[handle]
        
        if handle in self.buffers:
            del self.buffers[handle]

        if handle in self.reviewer_map:
            del self.reviewer_map[handle]

        # Check if active client exists
        if handle in self.live_clients:
            client = self.live_clients[handle]
            try:
                await client.stop()
                logger.info(f"Stopped client for @{handle}.")
            except Exception as e:
                logger.error(f"Error stopping client for @{handle}: {e}")
            
            # Remove from live_clients
            del self.live_clients[handle]
            return True
        
        logger.info(f"@{handle} was not connected.")
        return True

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
                stmt_reviewers = select(models.Reviewer).where(models.Reviewer.tiktok_handle.isnot(None))
                result_reviewers = await session.execute(stmt_reviewers)
                reviewers = result_reviewers.scalars().all()
                
                # Populate reviewer map
                for r in reviewers:
                    self.reviewer_map[r.tiktok_handle.lower()] = r.id

                unique_handles = set(monitored_handles) | set([r.tiktok_handle.lower() for r in reviewers])

                logger.info(f"Found {len(unique_handles)} handles for persistent connection: {unique_handles}")

                for handle in unique_handles:
                    if handle and handle not in self.live_clients:
                        self.persistent_connections.add(handle)
                        self.bot.loop.create_task(self._background_connect(None, handle, True))
            except Exception as e:
                logger.error(f"Error loading persistent connections: {e}", exc_info=True)

    async def flush_loop(self, tiktok_handle: str, reviewer_id: int):
        while True:
            await asyncio.sleep(2)
            if tiktok_handle in self.buffers:
                await self.flush(tiktok_handle, reviewer_id)

    async def flush(self, tiktok_handle: str, reviewer_id: int):
        """Writes buffered stats to DB and checks achievements."""
        buffer = self.buffers.get(tiktok_handle)
        if not buffer:
            return

        try:
            async with AsyncSessionLocal() as db:
                # 1. Update Reviewer (User) Stats
                reviewer = await db.get(models.Reviewer, reviewer_id)
                if not reviewer:
                    return

                user = await db.get(models.User, reviewer.user_id)

                # 2. Update Lifetime Stats
                likes_to_add = buffer.current_session_likes
                diamonds_to_add = buffer.current_session_diamonds

                if likes_to_add > 0:
                    logger.info(f"Flushing {likes_to_add} likes for reviewer {reviewer_id}")

                if likes_to_add > 0 or diamonds_to_add > 0:
                    user.lifetime_live_likes = (user.lifetime_live_likes or 0) + likes_to_add
                    user.lifetime_diamonds = (user.lifetime_diamonds or 0) + diamonds_to_add
                    db.add(user)

                    # --- COMMUNITY GOAL BATCH UPDATE (LIKES) ---
                    if likes_to_add > 0:
                        # Aggregate user likes for tickets
                        user_likes_map = {}
                        for uid, activity in buffer.user_chat_activity.items():
                            if activity['likes_sent'] > 0:
                                user_likes_map[uid] = activity['likes_sent']
                        
                        await giveaway_service.batch_update_community_goal_progress(
                            db, reviewer_id, 'LIKES', likes_to_add, user_likes_map
                        )

                    # --- COMMUNITY GOAL BATCH UPDATE (GIFTS) ---
                    if diamonds_to_add > 0:
                        # Aggregate user gifts for tickets
                        user_gifts_map = {}
                        for uid, activity in buffer.user_chat_activity.items():
                            if activity['gifts_sent'] > 0:
                                user_gifts_map[uid] = activity['gifts_sent']
                        
                        await giveaway_service.batch_update_community_goal_progress(
                            db, reviewer_id, 'GIFTS', diamonds_to_add, user_gifts_map
                        )

                # 2. Update Active Submission Stats (Average Viewers & Polls)
                active_sub = await queue_service.get_active_submission(db, reviewer_id)
                if active_sub:
                    # Viewers
                    avg_viewers = buffer.get_average_viewers()
                    if avg_viewers > 0:
                         active_sub.average_concurrent_viewers = avg_viewers

                    # Polls
                    poll_percent = buffer.get_poll_win_percent()
                    if poll_percent is not None:
                         active_sub.poll_result_w_percent = poll_percent

                    db.add(active_sub)

                # 3. Update LiveSession (if we had one)
                session = await db.execute(
                     select(models.LiveSession)
                     .filter(models.LiveSession.user_id == user.id, models.LiveSession.status == 'LIVE')
                     .order_by(models.LiveSession.start_time.desc())
                )
                live_session = session.scalars().first()

                if not live_session:
                    # Create one if we have activity
                    if likes_to_add > 0 or diamonds_to_add > 0:
                         live_session = models.LiveSession(
                             user_id=user.id,
                             tiktok_room_id=str(self.live_clients[tiktok_handle].room_id) if tiktok_handle in self.live_clients and self.live_clients[tiktok_handle].connected else None,
                             max_concurrent_viewers=buffer.get_average_viewers()
                         )
                         db.add(live_session)
                else:
                    # Update existing
                    live_session.total_likes = (live_session.total_likes or 0) + likes_to_add
                    live_session.total_diamonds = (live_session.total_diamonds or 0) + diamonds_to_add
                    current_max = live_session.max_concurrent_viewers or 0
                    window_max = max(buffer.viewer_count_samples) if buffer.viewer_count_samples else 0
                    if window_max > current_max:
                        live_session.max_concurrent_viewers = window_max
                    db.add(live_session)

                await db.commit()

                # 4. Check Achievements for Reviewer
                await achievement_service.trigger_achievement(db, user.id, "LIFETIME_LIKES", user.lifetime_live_likes)
                await achievement_service.trigger_achievement(db, user.id, "LIFETIME_DIAMONDS", user.lifetime_diamonds)
                await achievement_service.trigger_achievement(db, user.id, "CONCURRENT_VIEWERS", live_session.max_concurrent_viewers if live_session else 0)

                # 5. Check Achievements for Viewers
                for tiktok_username, activity in buffer.user_chat_activity.items():
                    viewer_user = await user_service.get_user_by_tiktok_username(db, tiktok_username)
                    if not viewer_user:
                        continue
                        
                    # Update Viewer Stats
                    if activity['likes_sent'] > 0:
                        viewer_user.lifetime_likes_sent = (viewer_user.lifetime_likes_sent or 0) + activity['likes_sent']
                        await achievement_service.trigger_achievement(db, viewer_user.id, "LIFETIME_LIKES_SENT", viewer_user.lifetime_likes_sent)
                        
                    if activity['gifts_sent'] > 0:
                        viewer_user.lifetime_gifts_sent = (viewer_user.lifetime_gifts_sent or 0) + activity['gifts_sent']
                        await achievement_service.trigger_achievement(db, viewer_user.id, "LIFETIME_GIFTS_SENT", viewer_user.lifetime_gifts_sent)

                    if activity['msg_count'] > 0:
                        viewer_user.lifetime_tiktok_comments = (viewer_user.lifetime_tiktok_comments or 0) + activity['msg_count']
                        await achievement_service.trigger_achievement(db, viewer_user.id, "LIFETIME_TIKTOK_COMMENTS", viewer_user.lifetime_tiktok_comments)

                    if activity['shares_sent'] > 0:
                        viewer_user.lifetime_tiktok_shares = (viewer_user.lifetime_tiktok_shares or 0) + activity['shares_sent']
                        await achievement_service.trigger_achievement(db, viewer_user.id, "LIFETIME_TIKTOK_SHARES", viewer_user.lifetime_tiktok_shares)
                        
                    db.add(viewer_user)

                    # Rainbow
                    if len(activity['rainbow']) >= 4:
                        await achievement_service.trigger_achievement(db, viewer_user.id, "CHAT_RAINBOW", specific_slug="rainbow")

                    # Town Crier
                    if activity['all_caps']:
                        await achievement_service.trigger_achievement(db, viewer_user.id, "CHAT_ALL_CAPS", specific_slug="town_crier")

                    # Emoji Chef
                    if activity['emoji_only']:
                        await achievement_service.trigger_achievement(db, viewer_user.id, "CHAT_EMOJI_ONLY", specific_slug="emoji_chef")

                # Reset Buffer
                buffer.reset()
                buffer.viewer_count_samples = [] # Clear samples for next window
                buffer.viewer_count_sum = 0

        except Exception as e:
            logger.error(f"Flush error for reviewer {reviewer_id}: {e}")

    def _setup_listeners(self, client: TikTokLiveClient, disconnect_event: asyncio.Event, session_id: Optional[int]):
        tiktok_handle = client.unique_id.replace('@', '').lower()
        reviewer_id = self.reviewer_map.get(tiktok_handle)

        @client.on(ConnectEvent)
        async def on_connect(event: ConnectEvent):
            logger.info(f"Successfully connected to @{client.unique_id}'s livestream!")
            
            # Create LiveSession record
            try:
                async with AsyncSessionLocal() as session:
                    # Check if host is a reviewer
                    stmt = select(models.Reviewer).join(models.User).where(models.Reviewer.tiktok_handle == client.unique_id)
                    result = await session.execute(stmt)
                    reviewer = result.scalar_one_or_none()
                    
                    if reviewer:
                        # Close any existing open sessions for this user to prevent duplicates
                        await session.execute(
                            update(models.LiveSession)
                            .where(
                                models.LiveSession.user_id == reviewer.user_id,
                                models.LiveSession.status == 'LIVE'
                            )
                            .values(status='ENDED', end_time=func.now())
                        )
                        
                        # Create new session
                        new_session = models.LiveSession(
                            user_id=reviewer.user_id,
                            tiktok_room_id=str(client.room_id),
                            status='LIVE',
                            start_time=func.now()
                        )
                        session.add(new_session)
                        await session.commit()
                        logger.info(f"Created new LiveSession for reviewer @{client.unique_id}")
            except Exception as e:
                logger.error(f"Error creating LiveSession on connect: {e}", exc_info=True)

        @client.on(DisconnectEvent)
        async def on_disconnect(event: DisconnectEvent):
            logger.warning(f"Disconnected from @{client.unique_id}'s livestream.")
            
            # End LiveSession record
            try:
                async with AsyncSessionLocal() as session:
                    stmt = select(models.Reviewer).where(models.Reviewer.tiktok_handle == client.unique_id)
                    result = await session.execute(stmt)
                    reviewer = result.scalar_one_or_none()
                    
                    if reviewer:
                        await session.execute(
                            update(models.LiveSession)
                            .where(
                                models.LiveSession.user_id == reviewer.user_id,
                                models.LiveSession.status == 'LIVE'
                            )
                            .values(status='ENDED', end_time=func.now())
                        )
                        await session.commit()
                        logger.info(f"Ended LiveSession for reviewer @{client.unique_id}")
            except Exception as e:
                logger.error(f"Error ending LiveSession on disconnect: {e}", exc_info=True)

            if client.unique_id in self.persistent_connections and not disconnect_event.is_set():
                logger.info(f"Attempting to reconnect to @{client.unique_id}...")
                disconnect_event.set() 
            else:
                disconnect_event.set()

        @client.on(LiveEndEvent)
        async def on_live_end(event: LiveEndEvent):
            try:
                logger.info(f"@{client.unique_id}'s livestream has ended.")
                # End LiveSession record
                async with AsyncSessionLocal() as session:
                    stmt = select(models.Reviewer).where(models.Reviewer.tiktok_handle == client.unique_id)
                    result = await session.execute(stmt)
                    reviewer = result.scalar_one_or_none()
                    
                    if reviewer:
                        await session.execute(
                            update(models.LiveSession)
                            .where(
                                models.LiveSession.user_id == reviewer.user_id,
                                models.LiveSession.status == 'LIVE'
                            )
                            .values(status='ENDED', end_time=func.now())
                        )
                        await session.commit()
                        logger.info(f"Ended LiveSession for reviewer @{client.unique_id} (LiveEndEvent)")
            except Exception as e:
                logger.error(f"Error ending LiveSession on live end: {e}", exc_info=True)
            
            disconnect_event.set()

        @client.on(GiftEvent)
        async def on_gift(event: GiftEvent):
            # If the gift is streakable and the streak is not over, wait for the final event
            if hasattr(event.gift, 'streakable') and event.gift.streakable and hasattr(event, 'streaking') and event.streaking:
                return

            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)
            
            # Buffer Logic
            if tiktok_handle in self.buffers:
                self.buffers[tiktok_handle].add_diamonds(event.gift.diamond_count)
                
                user_id = event.user.unique_id
                if user_id not in self.buffers[tiktok_handle].user_chat_activity:
                    self.buffers[tiktok_handle].user_chat_activity[user_id] = {
                        'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                    }
                self.buffers[tiktok_handle].user_chat_activity[user_id]['gifts_sent'] += event.gift.diamond_count

            # Community Goal: GIFTS
            if reviewer_id:
                async with AsyncSessionLocal() as db:
                    await giveaway_service.update_community_goal_progress(
                        db, 
                        reviewer_id, 
                        'GIFTS', 
                        event.gift.diamond_count, 
                        user_id=event.user.unique_id,
                        username=event.user.unique_id
                    )

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

                except Exception as e:
                    logger.error(f"Error processing gift event: {e}", exc_info=True)

        @client.on(LikeEvent)
        async def on_like(event: LikeEvent):
            user_handle = event.user.unique_id
            user_level = getattr(event.user, 'level', 0)
            
            # Buffer Logic
            if tiktok_handle in self.buffers:
                self.buffers[tiktok_handle].add_likes(event.count)
                
                # Track user likes sent
                user_id = event.user.unique_id
                if user_id not in self.buffers[tiktok_handle].user_chat_activity:
                    self.buffers[tiktok_handle].user_chat_activity[user_id] = {
                        'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                    }
                self.buffers[tiktok_handle].user_chat_activity[user_id]['likes_sent'] += event.count

            # Community Goal: LIKES
            if reviewer_id:
                async with AsyncSessionLocal() as db:
                    await giveaway_service.update_community_goal_progress(
                        db, 
                        reviewer_id, 
                        'LIKES', 
                        event.count, 
                        user_id=event.user.unique_id,
                        username=event.user.unique_id
                    )

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
            
            # Buffer Logic
            if tiktok_handle in self.buffers:
                user_id = event.user.unique_id
                if user_id not in self.buffers[tiktok_handle].user_chat_activity:
                    self.buffers[tiktok_handle].user_chat_activity[user_id] = {
                        'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                    }
                self.buffers[tiktok_handle].user_chat_activity[user_id]['shares_sent'] += 1
                
            # Community Goal: SHARES
            if reviewer_id:
                async with AsyncSessionLocal() as db:
                    await giveaway_service.update_community_goal_progress(
                        db, 
                        reviewer_id, 
                        'SHARES', 
                        1, 
                        user_id=event.user.unique_id,
                        username=event.user.unique_id
                    )

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
            
            # Buffer Logic
            if tiktok_handle in self.buffers:
                buffer = self.buffers[tiktok_handle]
                
                # Parse for W/L or Smile/Cry
                content = event.comment.lower()
                if "😊" in content or "w" in content or "🔥" in content:
                    buffer.add_emoji_vote(is_positive=True)
                elif "😭" in content or "l" in content or "👎" in content:
                    buffer.add_emoji_vote(is_positive=False)

                # Track user activity
                user_id = event.user.unique_id
                if user_id not in buffer.user_chat_activity:
                    buffer.user_chat_activity[user_id] = {
                        'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                    }
                
                activity = buffer.user_chat_activity[user_id]
                activity['msg_count'] += 1

                # 1. Rainbow (Hearts)
                for heart in ["❤️", "💙", "💚", "💜"]:
                    if heart in event.comment:
                        activity['rainbow'].add(heart)

                # 2. Town Crier (All Caps)
                if len(event.comment) >= 10 and event.comment.isupper():
                    activity['all_caps'] = True

                # 3. Emoji Chef (Emoji Only)
                import re
                if len(event.comment) >= 5 and not re.search('[a-zA-Z0-9]', event.comment):
                    activity['emoji_only'] = True
                
            # Community Goal: COMMENTS
            if reviewer_id:
                async with AsyncSessionLocal() as db:
                    await giveaway_service.update_community_goal_progress(db, reviewer_id, 'COMMENTS', 1, username=event.user.unique_id, user_id=event.user.unique_id)

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

                    # Broadcast chat message
                    stmt_reviewer = select(models.Reviewer).where(models.Reviewer.tiktok_handle == client.unique_id)
                    res_reviewer = await session.execute(stmt_reviewer)
                    reviewer_obj = res_reviewer.scalar_one_or_none()

                    if reviewer_obj:
                        import uuid
                        chat_data = {
                            "id": str(uuid.uuid4()),
                            "username": event.user.unique_id,
                            "nickname": getattr(event.user, 'nickname', event.user.unique_id),
                            "avatar_url": getattr(event.user, 'avatar', {}).get('thumb', ''),
                            "comment": event.comment,
                            "timestamp": int(time.time() * 1000),
                            "user_level": user_level,
                            "is_member": getattr(event.user, 'is_subscribe', False),
                            "is_moderator": getattr(event.user, 'is_moderator', False),
                            "is_follower": getattr(event.user, 'is_follower', False),
                            "top_gifter_rank": getattr(event.user, 'top_vip_no', 0)
                        }
                        await broadcast_service.emit_chat_message(reviewer_obj.id, chat_data)

                except Exception as e:
                    logger.error(f"Error processing comment event: {e}", exc_info=True)

        @client.on(JoinEvent)
        async def on_join(event: JoinEvent):
            logger.info(f"{event.user.unique_id} joined the stream.")
            try:
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
            
            # Buffer Logic
            if tiktok_handle in self.buffers:
                self.buffers[tiktok_handle].add_viewer_sample(event.m_total)

            try:
                logger.info(f"Viewer count updated to {event.m_total} (total_user: {getattr(event, 'total_user', 'N/A')}).")
                async with AsyncSessionLocal() as session:
                    interaction = models.TikTokInteraction(
                        session_id=session_id,
                        host_handle=client.unique_id,
                        interaction_type='VIEWER_COUNT_UPDATE',
                        value=str(event.m_total),
                    )
                    session.add(interaction)
                    
                    if hasattr(event, 'total_user'):
                        interaction_total = models.TikTokInteraction(
                            session_id=session_id,
                            host_handle=client.unique_id,
                            interaction_type='TOTAL_VIEWERS_UPDATE',
                            value=str(event.total_user),
                        )
                        session.add(interaction_total)

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
        
        # Note: tiktok_account.user_id is the linked Discord user ID (models.User.id)
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
                        
                        # Populate reviewer map if not present
                        if unique_id not in self.reviewer_map:
                            stmt_rev = select(models.Reviewer).where(models.Reviewer.tiktok_handle == unique_id)
                            res_rev = await session.execute(stmt_rev)
                            rev = res_rev.scalar_one_or_none()
                            if rev:
                                self.reviewer_map[unique_id] = rev.id

                    # Prepare client arguments
                    client_kwargs = {}
                    tiktok_session_id = os.getenv("TIKTOK_SESSION_ID")
                    if tiktok_session_id:
                        client_kwargs["cookies"] = {"sessionid": tiktok_session_id}
                        logger.info(f"Using configured TIKTOK_SESSION_ID for connection to @{unique_id}")

                    # Configure Sign API Key globally via WebDefaults
                    from config import settings
                    if settings.TIKTOK_SIGN_API_KEY:
                        from TikTokLive.client.web.web_settings import WebDefaults
                        WebDefaults.tiktok_sign_api_key = settings.TIKTOK_SIGN_API_KEY
                        logger.info(f"Configured WebDefaults.tiktok_sign_api_key for connection to @{unique_id}")

                    client = TikTokLiveClient(unique_id=f"@{unique_id}", **client_kwargs)
                    self._setup_listeners(client, disconnect_event, session_id)

                    self.live_clients[unique_id] = client
                    
                    # Initialize Buffer and Flush Task if Reviewer
                    if unique_id in self.reviewer_map:
                        self.buffers[unique_id] = StreamBuffer()
                        self.flush_tasks[unique_id] = asyncio.create_task(self.flush_loop(unique_id, self.reviewer_map[unique_id]))
                        logger.info(f"Initialized StreamBuffer and Flush Task for reviewer @{unique_id}")

                    if persistent:
                        self.persistent_connections.add(unique_id)

                    await client.start()

                    # Wait until the disconnect event is set
                    await disconnect_event.wait()
                except UserOfflineError:
                    logger.info(f"Connection attempt failed for @{unique_id} because the user is offline.")
                    if interaction:
                        await interaction.followup.send(f"❌ **User Offline:** Could not connect to @{unique_id}.", ephemeral=True)
                    break

                except SignAPIError as e:
                    logger.warning(f"Sign API Error connecting to @{unique_id}: {e}")
                    if attempt < max_retries - 1:
                        logger.info(f"Retrying connection to @{unique_id} in 5 seconds (SignAPIError)...")
                        await asyncio.sleep(5)
                        continue

                    if interaction:
                        await interaction.followup.send(f"❌ **Sign API Error:** Could not connect to @{unique_id}. Please try again later.", ephemeral=True)
                    break

                except UserNotFoundError:
                    logger.warning(f"User @{unique_id} not found (UserNotFoundError). Likely offline or banned.")
                    if attempt < max_retries - 1:
                        logger.info(f"Retrying connection to @{unique_id} in 30 seconds (UserNotFound)...")
                        await asyncio.sleep(30)
                        continue
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
        self.bot.loop.create_task(self._background_connect(interaction, handle, persistent=False))

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