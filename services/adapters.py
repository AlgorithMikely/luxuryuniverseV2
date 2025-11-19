from abc import ABC, abstractmethod
from typing import Callable, Awaitable, Any
from TikTokLive import TikTokLiveClient
from TikTokLive.types.events import ConnectEvent, GiftEvent, LikeEvent
import logging

class LiveListener(ABC):
    """
    Abstract base class for live stream listeners (TikTok, Twitch, YouTube, etc.).
    Follows the Adapter Pattern to unify different platforms.
    """
    def __init__(self, handle: str):
        self.handle = handle
        self.on_gift_callback: Callable[[str, str, int, str], Awaitable[None]] | None = None
        self.on_like_callback: Callable[[str, str, int], Awaitable[None]] | None = None

    @abstractmethod
    async def start(self):
        """Starts the listener."""
        pass

    def set_on_gift(self, callback: Callable[[str, str, int, str], Awaitable[None]]):
        """
        Sets the callback for gift events.
        Callback signature: (user_unique_id, gift_name, diamond_count, user_name)
        """
        self.on_gift_callback = callback

    def set_on_like(self, callback: Callable[[str, str, int], Awaitable[None]]):
        """
        Sets the callback for like events.
        Callback signature: (user_unique_id, like_count, user_name)
        """
        self.on_like_callback = callback


class TikTokLiveListener(LiveListener):
    """
    Adapter for TikTokLiveClient.
    """
    def __init__(self, handle: str):
        super().__init__(handle)
        self.client: TikTokLiveClient = TikTokLiveClient(unique_id=handle)
        self._setup_events()

    def _setup_events(self):
        @self.client.on("connect")
        async def on_connect(_: ConnectEvent):
            logging.info(f"Connected to TikTok Live: @{self.handle}")

        @self.client.on("like")
        async def on_like(event: LikeEvent):
            if self.on_like_callback:
                # TikTok 'like' event usually sends a batch of likes, or 1.
                # We'll assume 1 for now or use event.count if available/reliable.
                # event.count is total likes usually, event.like_count is batch.
                # Let's just pass 1 for each event for simplicity or check documentation.
                # Assuming 1 per event trigger for now as per typical usage.
                await self.on_like_callback(event.user.unique_id, 1, event.user.nickname)

        @self.client.on("gift")
        async def on_gift(event: GiftEvent):
            if self.on_gift_callback:
                # event.gift.diamond_count is the value
                await self.on_gift_callback(
                    event.user.unique_id,
                    event.gift.info.name,
                    event.gift.diamond_count,
                    event.user.nickname
                )

    async def start(self):
        try:
            await self.client.start()
        except Exception as e:
            logging.error(f"Error in TikTok listener for @{self.handle}: {e}")
            # Re-raise or handle retry logic in the manager
            raise e
