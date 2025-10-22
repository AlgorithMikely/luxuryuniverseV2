import asyncio
from TikTokLive import TikTokLiveClient
from TikTokLive.types.events import CommentEvent, ConnectEvent, GiftEvent, LikeEvent
from database import SessionLocal
from services import economy_service, user_service
import models

async def run_listener(reviewer: models.Reviewer):
    """Runs a TikTok listener for a single reviewer."""
    client: TikTokLiveClient = TikTokLiveClient(unique_id=reviewer.tiktok_handle)

    @client.on("connect")
    async def on_connect(_: ConnectEvent):
        print(f"Connected to @{reviewer.tiktok_handle}")

    @client.on("like")
    async def on_like(event: LikeEvent):
        with SessionLocal() as db:
            config = economy_service.get_economy_config(db, reviewer.id)
            amount = config.get("like", 1)
            user = user_service.get_user_by_tiktok_username(db, event.user.unique_id)
            if user:
                await economy_service.add_coins(
                    db,
                    reviewer_id=reviewer.id,
                    user_id=user.id,
                    amount=amount,
                    reason="TikTok Like"
                )

    @client.on("gift")
    async def on_gift(event: GiftEvent):
         with SessionLocal() as db:
            config = economy_service.get_economy_config(db, reviewer.id)
            amount = config.get("gift", 5) * event.gift.diamond_count
            user = user_service.get_user_by_tiktok_username(db, event.user.unique_id)
            if user:
                await economy_service.add_coins(
                    db,
                    reviewer_id=reviewer.id,
                    user_id=user.id,
                    amount=amount,
                    reason=f"TikTok Gift: {event.gift.info.name}"
                )

    try:
        await client.start()
    except Exception as e:
        print(f"Error starting listener for @{reviewer.tiktok_handle}: {e}")
        # In a real application, you'd want more robust error handling and retry logic here
        await asyncio.sleep(60)
        asyncio.create_task(run_listener(reviewer))

async def main():
    """The main entrypoint for the TikTok listener."""
    with SessionLocal() as db:
        reviewers = db.query(models.Reviewer).filter(models.Reviewer.tiktok_handle.isnot(None)).all()

    await asyncio.gather(*[run_listener(reviewer) for reviewer in reviewers])

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("TikTok listener shut down.")
