import asyncio
import logging
from database import AsyncSessionLocal
from services import economy_service, user_service, adapters
from sqlalchemy import select
import models

# Configure logging
logging.basicConfig(level=logging.INFO)

async def run_listener_manager():
    """
    Main loop to manage listeners.
    In a real production app, this might be more complex (dynamic adding/removing).
    For now, it loads active reviewers on startup.
    """
    logging.info("Starting Listener Manager...")
    
    listeners = []

    async with AsyncSessionLocal() as db:
        # Fetch all reviewers who have a TikTok handle
        result = await db.execute(
            select(models.Reviewer).where(models.Reviewer.tiktok_handle.isnot(None))
        )
        reviewers = result.scalars().all()

        for reviewer in reviewers:
            logging.info(f"Initializing listener for reviewer {reviewer.id} (@{reviewer.tiktok_handle})")
            
            # Create the adapter
            listener = adapters.TikTokLiveListener(handle=reviewer.tiktok_handle)

            # Define callbacks with closure to capture reviewer_id
            async def on_gift(user_unique_id, gift_name, diamond_count, user_name, r_id=reviewer.id):
                async with AsyncSessionLocal() as session:
                    # Reload config to get fresh rates
                    config = await economy_service.get_economy_config(session, r_id)
                    multiplier = config.get("gift", 5) # Default 5 coins per diamond
                    amount = diamond_count * multiplier
                    
                    user = await user_service.get_user_by_tiktok_username(session, user_unique_id)
                    if user:
                        await economy_service.add_coins(
                            session,
                            reviewer_id=r_id,
                            user_id=user.id,
                            amount=amount,
                            reason=f"TikTok Gift: {gift_name} (x{diamond_count})"
                        )
                        logging.info(f"Awarded {amount} coins to {user.username} for gift {gift_name}")
                    else:
                        logging.warning(f"User {user_unique_id} not found in DB. Coins not awarded.")

            async def on_like(user_unique_id, count, user_name, r_id=reviewer.id):
                async with AsyncSessionLocal() as session:
                    config = await economy_service.get_economy_config(session, r_id)
                    amount = config.get("like", 1) * count
                    
                    user = await user_service.get_user_by_tiktok_username(session, user_unique_id)
                    if user:
                        await economy_service.add_coins(
                            session,
                            reviewer_id=r_id,
                            user_id=user.id,
                            amount=amount,
                            reason="TikTok Like"
                        )
                        logging.info(f"Awarded {amount} coins to {user.username} for like")

            # Attach callbacks
            listener.set_on_gift(on_gift)
            listener.set_on_like(on_like)
            
            listeners.append(listener)

    # Run all listeners concurrently
    if not listeners:
        logging.warning("No reviewers with TikTok handles found.")
        return

    await asyncio.gather(*[l.start() for l in listeners])

if __name__ == "__main__":
    try:
        asyncio.run(run_listener_manager())
    except KeyboardInterrupt:
        logging.info("Listener Manager shutting down.")
