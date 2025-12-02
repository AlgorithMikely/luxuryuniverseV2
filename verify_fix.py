import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.getcwd())

from database import get_db, AsyncSessionLocal
import models
from services import queue_service, user_service

async def verify_fix():
    print("Starting verification...")
    async with AsyncSessionLocal() as db:
        username = "guest_user_verify_test"
        reviewer_id = 1 # Assuming reviewer 1 exists

        # 1. Ensure user does not exist
        print(f"Checking if user {username} exists...")
        user = await user_service.get_user_by_tiktok_username(db, username)
        if user:
            print(f"User {username} already exists. Deleting for test...")
            # Delete submissions first
            from sqlalchemy import delete
            await db.execute(delete(models.Submission).where(models.Submission.user_id == user.id))
            await db.delete(user)
            await db.commit()
        
        # 2. Call apply_free_skip directly
        print(f"Calling apply_free_skip for {username}...")
        await queue_service.apply_free_skip(db, reviewer_id, username)

        # 3. Verify user creation
        print(f"Verifying user {username} was created...")
        user = await user_service.get_user_by_tiktok_username(db, username)
        
        if user:
            print(f"SUCCESS: User {username} created!")
            print(f"User details: ID={user.id}, Guest={user.is_guest}, TikTok={user.tiktok_username}")
            
            # 4. Verify submission creation
            stmt = select(models.Submission).filter(
                models.Submission.user_id == user.id,
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.priority_value == 50
            )
            result = await db.execute(stmt)
            submission = result.scalars().first()
            
            if submission:
                print(f"SUCCESS: Submission created! ID={submission.id}, Priority={submission.priority_value}")
            else:
                print("FAILURE: Submission NOT created.")
        else:
            print("FAILURE: User NOT created.")

if __name__ == "__main__":
    asyncio.run(verify_fix())
