import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.getcwd())

from services import giveaway_service
from database import get_db
from models import Reviewer

async def trigger_update():
    print("Waiting 15 seconds before triggering update...")
    await asyncio.sleep(15)

    # Setup DB connection
    # Assuming local dev environment
    DATABASE_URL = "sqlite+aiosqlite:///./local_migrations.db" 
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Find the reviewer 'luxuryforbes' (or just the first one)
        # We need the ID.
        # Let's just hardcode ID 1 for now or find by handle if possible, 
        # but giveaway_service needs reviewer_id.
        # Let's assume ID 1 is luxuryforbes based on previous context.
        reviewer_id = 1 
        
        print(f"Triggering update for reviewer {reviewer_id}...")
        
        # Update SHARES goal by adding 10 shares
        # type="SHARES", amount=10
        await giveaway_service.update_community_goal_progress(
            db, 
            reviewer_id, 
            "SHARES", 
            10
        )
        print("Update triggered successfully.")

if __name__ == "__main__":
    asyncio.run(trigger_update())
