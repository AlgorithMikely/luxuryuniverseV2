import asyncio
import logging
from datetime import datetime, timezone
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, GiftEvent, LikeEvent, CommentEvent, ViewerUpdateEvent, ShareEvent
from database import AsyncSessionLocal
from services import economy_service, user_service, queue_service
import models
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
# Import achievement service
from services import achievement_service
from services import giveaway_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

class ReviewerListener:
    def __init__(self, reviewer_id: int, tiktok_handle: str):
        self.reviewer_id = reviewer_id
        self.tiktok_handle = tiktok_handle
        self.buffer = StreamBuffer()
        
        # Prepare client arguments
        import os
        client_kwargs = {}
        tiktok_session_id = os.getenv("TIKTOK_SESSION_ID")
        if tiktok_session_id:
            client_kwargs["cookies"] = {"sessionid": tiktok_session_id}
            logger.info(f"Using configured TIKTOK_SESSION_ID for connection to @{tiktok_handle}")

        self.client = TikTokLiveClient(unique_id=tiktok_handle, **client_kwargs)
        self.running = False
        self.flush_task = None

    async def start(self):
        self.setup_events()
        self.running = True
        # Start flush loop
        self.flush_task = asyncio.create_task(self.flush_loop())
        try:
            await self.client.start()
        except Exception as e:
            logger.error(f"TikTok client error for {self.tiktok_handle}: {e}")
            self.running = False

    def setup_events(self):
        @self.client.on("connect")
        async def on_connect(_: ConnectEvent):
            logger.info(f"Connected to @{self.tiktok_handle}")
            # Ensure LiveSession exists? We can do this in flush if needed.

        @self.client.on("like")
        async def on_like(event: LikeEvent):
            # event.count is the total likes sent in this batch (often > 1)
            # event.total_likes is the room's total likes.
            # We can track delta or just trust the stream.
            # Using event.count is safer for "new likes since last event".
            self.buffer.add_likes(event.count)
            
            # Track user likes sent
            user_id = event.user.unique_id
            if user_id not in self.buffer.user_chat_activity:
                self.buffer.user_chat_activity[user_id] = {
                    'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                }
            self.buffer.user_chat_activity[user_id]['likes_sent'] += event.count

            # Economy logic (Coins for Likes) - Keep this immediate or buffer?
            # PRD says "Flush... update database".
            # But economy transactions are per-user. Buffering user-specific likes is complex.
            # For now, we will keep the Economy Logic for *Users* as is (immediate),
            # but use the Buffer for *Reviewer Stats*.
            # OPTIMIZATION: In high load, we should buffer user coins too, but that's out of scope for this specific PRD item.
            async with AsyncSessionLocal() as db:
                 config = await economy_service.get_economy_config(db, self.reviewer_id)
                 amount = config.get("like", 1)
                 # Processing every like event for economy might be heavy.

            # Track user gifts sent (diamonds value)
            user_id = event.user.unique_id
            if user_id not in self.buffer.user_chat_activity:
                self.buffer.user_chat_activity[user_id] = {
                    'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                }
            self.buffer.user_chat_activity[user_id]['gifts_sent'] += event.gift.diamond_count

            # Economy Logic
            async with AsyncSessionLocal() as db:
                config = await economy_service.get_economy_config(db, self.reviewer_id)
                amount = config.get("gift", 5) * event.gift.diamond_count
                try:
                    user = await user_service.get_user_by_tiktok_username(db, event.user.unique_id)
                    if user:
                         await economy_service.add_coins(db, self.reviewer_id, user.id, amount, f"TikTok Gift: {event.gift.info.name}")
                except Exception as e:
                    logger.error(f"Economy error: {e}")

        @self.client.on("viewer_update")
        async def on_viewer_update(event: ViewerUpdateEvent):
             self.buffer.add_viewer_sample(event.viewer_count)

        @self.client.on("share")
        async def on_share(event: ShareEvent):
            user_id = event.user.unique_id
            if user_id not in self.buffer.user_chat_activity:
                self.buffer.user_chat_activity[user_id] = {
                    'rainbow': set(), 'all_caps': False, 'emoji_only': False, 'msg_count': 0, 'likes_sent': 0, 'gifts_sent': 0, 'shares_sent': 0
                }
            self.buffer.user_chat_activity[user_id]['shares_sent'] += 1

            # Community Goal: SHARES
            async with AsyncSessionLocal() as db:
                await giveaway_service.update_community_goal_progress(db, self.reviewer_id, 'SHARES', 1, username=event.user.unique_id)

        # Fallback for Polls: Chat Emoji Tracking
        @self.client.on("comment")
        async def on_comment(event: CommentEvent):
            # Parse for W/L or Smile/Cry
            content = event.comment.lower()

            if "😊" in content or "w" in content or "🔥" in content:
                self.buffer.add_emoji_vote(is_positive=True)
            elif "😭" in content or "l" in content or "👎" in content:
                self.buffer.add_emoji_vote(is_positive=False)

            # Community Goal: COMMENTS
            async with AsyncSessionLocal() as db:
                await giveaway_service.update_community_goal_progress(db, self.reviewer_id, 'COMMENTS', 1, username=event.user.unique_id, user_id=event.user.unique_id)

            # --- TRACKING FOR ACHIEVEMENTS (Rainbow, Town Crier, Emoji Chef) ---
            user_id = event.user.unique_id
            if user_id not in self.buffer.user_chat_activity:
                self.buffer.user_chat_activity[user_id] = {
                    'rainbow': set(),
                    'all_caps': False,
                    'emoji_only': False,
                    'msg_count': 0,
                    'likes_sent': 0,
                    'gifts_sent': 0,
                    'shares_sent': 0
                }

            # Update Avatar if needed (Self-Healing)
            try:
                # TikTokLive User object usually has avatar_thumb.url_list
                avatar_url = None
                if hasattr(event.user, 'avatar_thumb') and hasattr(event.user.avatar_thumb, 'url_list'):
                    if event.user.avatar_thumb.url_list:
                        avatar_url = event.user.avatar_thumb.url_list[0]
                
                if avatar_url:
                    async with AsyncSessionLocal() as db:
                        user = await user_service.get_user_by_tiktok_username(db, user_id)
                        # Only update if user is a guest OR has no avatar set
                        # We want to preserve the Discord avatar for verified users
                        if user and (user.is_guest or not user.avatar):
                            if user.avatar != avatar_url:
                                user.avatar = avatar_url
                                await db.commit()
            except Exception as e:
                logger.error(f"Failed to update avatar for {user_id}: {e}")

            activity = self.buffer.user_chat_activity[user_id]
            activity['msg_count'] += 1

            # 1. Rainbow (Hearts)
            # Check for specific heart emojis
            # Red: ❤️, Blue: 💙, Green: 💚, Purple: 💜
            for heart in ["❤️", "💙", "💚", "💜"]:
                if heart in event.comment:
                    activity['rainbow'].add(heart)

            # 2. Town Crier (All Caps)
            # Min 10 chars, all caps
            if len(event.comment) >= 10 and event.comment.isupper():
                activity['all_caps'] = True

            # 3. Emoji Chef (Emoji Only)
            # Min 5 chars? The requirement says "min 5 emojis".
            # Simple check: remove spaces/punctuation and see if only emojis remain.
            # This is complex in Python without regex/emoji lib.
            # Approximation: check if count of emojis >= 5 and length matches roughly.
            # Or just check if specific common emojis are present >= 5 times.
            # Better approximation: Check if no [a-zA-Z0-9] characters are present.
            import re
            if len(event.comment) >= 5 and not re.search('[a-zA-Z0-9]', event.comment):
                activity['emoji_only'] = True

    async def flush_loop(self):
        while self.running:
            await asyncio.sleep(2)
            await self.flush()

    async def flush(self):
        """Writes buffered stats to DB and checks achievements."""
        try:
            async with AsyncSessionLocal() as db:
                # 1. Update Reviewer (User) Stats
                # We need to fetch the reviewer's User ID
                reviewer = await db.get(models.Reviewer, self.reviewer_id)
                if not reviewer:
                    return

                user = await db.get(models.User, reviewer.user_id)

                # 2. Update Lifetime Stats
                likes_to_add = self.buffer.current_session_likes
                diamonds_to_add = self.buffer.current_session_diamonds

                if likes_to_add > 0:
                    logger.info(f"Flushing {likes_to_add} likes for reviewer {self.reviewer_id}")

                if likes_to_add > 0 or diamonds_to_add > 0:
                    user.lifetime_live_likes = (user.lifetime_live_likes or 0) + likes_to_add
                    user.lifetime_diamonds = (user.lifetime_diamonds or 0) + diamonds_to_add
                    db.add(user)

                    # --- COMMUNITY GOAL BATCH UPDATE (LIKES) ---
                    if likes_to_add > 0:
                        # Aggregate user likes for tickets
                        user_likes_map = {}
                        for uid, activity in self.buffer.user_chat_activity.items():
                            if activity['likes_sent'] > 0:
                                user_likes_map[uid] = activity['likes_sent']
                        
                        await giveaway_service.batch_update_community_goal_progress(
                            db, self.reviewer_id, 'LIKES', likes_to_add, user_likes_map
                        )

                # 2. Update Active Submission Stats (Average Viewers & Polls)
                # Get active submission
                active_sub = await queue_service.get_active_submission(db, self.reviewer_id)
                if active_sub:
                    # Viewers
                    avg_viewers = self.buffer.get_average_viewers()
                    if avg_viewers > 0:
                         active_sub.average_concurrent_viewers = avg_viewers

                    # Polls (Cumulative for this submission)
                    # We are calculating percentage for this *window*.
                    # If we want cumulative for the submission, we should add raw counts to DB or weighted average.
                    # Given DB schema has only `poll_result_w_percent`, we'll assume we overwrite with the latest valid sample
                    # OR we should have stored raw votes.
                    # Since we only have percent, let's update it if we have votes in this window.
                    # Better: If we want it to be representative of the whole track, we need to know previous totals.
                    # Limitation: Schema only has percent. We will update it with the current window's result
                    # if significant votes occurred (> 5 maybe to avoid noise?).
                    poll_percent = self.buffer.get_poll_win_percent()
                    if poll_percent is not None:
                        # Simple overwrite for V1 as per schema limitation
                         active_sub.poll_result_w_percent = poll_percent

                    db.add(active_sub)

                # 3. Update LiveSession (if we had one)
                # We could create/get a LiveSession for today.
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
                             tiktok_room_id=str(self.client.room_id) if self.client.connected else None,
                             max_concurrent_viewers=self.buffer.get_average_viewers()
                         )
                         db.add(live_session)
                else:
                    # Update existing
                    live_session.total_likes = (live_session.total_likes or 0) + likes_to_add
                    live_session.total_diamonds = (live_session.total_diamonds or 0) + diamonds_to_add
                    current_max = live_session.max_concurrent_viewers or 0
                    window_max = max(self.buffer.viewer_count_samples) if self.buffer.viewer_count_samples else 0
                    if window_max > current_max:
                        live_session.max_concurrent_viewers = window_max
                    db.add(live_session)

                await db.commit()

                # 4. Check Achievements for Reviewer (Track A - The Opener, etc.)
                # We check LIFETIME_LIKES, LIFETIME_DIAMONDS
                await achievement_service.trigger_achievement(db, user.id, "LIFETIME_LIKES", user.lifetime_live_likes)
                await achievement_service.trigger_achievement(db, user.id, "LIFETIME_DIAMONDS", user.lifetime_diamonds)
                await achievement_service.trigger_achievement(db, user.id, "CONCURRENT_VIEWERS", live_session.max_concurrent_viewers if live_session else 0)

                # 5. Check Achievements for Viewers (Track B - Front Row)
                # We iterate over the buffered user activity
                for tiktok_username, activity in self.buffer.user_chat_activity.items():
                    # We need to map TikTok username to our DB User
                    # This is heavy if many users. Ideally we cache this mapping or query in batch.
                    # For now, one by one.
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

                    # "Active Listener" logic could go here (msg count)
                    # But schema says "100 comments". We should increment a DB counter for that.
                    # Skipping persistent generic stats for now unless asked, prioritizing the explicit achievements.

                # Reset Buffer
                self.buffer.reset()
                self.buffer.viewer_count_samples = [] # Clear samples for next window
                self.buffer.viewer_count_sum = 0

        except Exception as e:
            logger.error(f"Flush error for reviewer {self.reviewer_id}: {e}")


async def main():
    """Main entrypoint."""
    async with AsyncSessionLocal() as db:
        # Get reviewers with tiktok handles
        result = await db.execute(select(models.Reviewer).where(models.Reviewer.tiktok_handle.isnot(None)))
        reviewers = result.scalars().all()

    listeners = [ReviewerListener(r.id, r.tiktok_handle) for r in reviewers]

    if not listeners:
        logger.info("No reviewers to monitor.")
        return

    await asyncio.gather(*[l.start() for l in listeners])

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
