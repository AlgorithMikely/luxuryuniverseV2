import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from api import queue_line_api
from database import get_db
from services import queue_service
import models
import schemas

async def test_line_api():
    # Setup DB connection
    db_path = os.path.join(os.getcwd(), 'backend', 'local_migrations.db').replace('\\', '/')
    DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        print("Testing get_line_view...")
        try:
            # Assuming reviewer ID 1 or handle 'admin' exists. Adjust as needed.
            # Let's try to find a reviewer first
            from sqlalchemy import select
            result = await db.execute(select(models.Reviewer).limit(1))
            reviewer = result.scalars().first()
            
            if not reviewer:
                print("No reviewer found in DB.")
                return

            print(f"Found reviewer: {reviewer.tiktok_handle} (ID: {reviewer.id})")
            
            # Call the API function directly (bypassing FastAPI dependency injection for simplicity if possible, 
            # but we need to mock dependencies or just call the service logic)
            
            # Actually, calling the API function directly requires mocking dependencies.
            # Let's just run the logic inside get_line_view manually to see where it breaks.
            
            # 1. Fetch Queue State
            print("Fetching initial state...")
            full_state = await queue_service.get_initial_state(db, reviewer.id)
            print("Initial state fetched.")
            
            # 2. Iterate queue
            print(f"Queue length: {len(full_state.queue)}")
            for idx, sub in enumerate(full_state.queue):
                print(f"Processing sub {sub.id}...")
                # Simulate the loop in queue_line_api.py
                if sub.spotlighted:
                    continue
                
                cover_art = sub.cover_art_url
                print(f"  Cover art: {cover_art}")
                
                if sub.priority_value > 0:
                    item = schemas.PriorityQueueItem(
                        pos=idx,
                        submission_id=sub.id,
                        user=sub.user.username,
                        type="PAID_PRIORITY",
                        amount=sub.priority_value,
                        style="GOLD",
                        track_title=sub.track_title,
                        artist=sub.artist,
                        track_url=sub.track_url,
                        cover_art_url=sub.cover_art_url
                    )
                    print("  Created PriorityQueueItem")
            
            print("Test completed successfully.")
            
        except Exception as e:
            print(f"Caught exception: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_line_api())
