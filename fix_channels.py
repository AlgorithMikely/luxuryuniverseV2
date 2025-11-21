import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import AsyncSessionLocal
from models import Reviewer, User

async def fix_channels():
    async with AsyncSessionLocal() as db:
        # Find the user 'aimlmusic'
        stmt = select(User).filter(User.username == 'aimlmusic')
        result = await db.execute(stmt)
        user = result.scalars().first()
        
        if not user:
            print("User 'aimlmusic' not found.")
            return

        # Find their reviewer profile
        stmt_rev = select(Reviewer).filter(Reviewer.user_id == user.id)
        result_rev = await db.execute(stmt_rev)
        reviewer = result_rev.scalars().first()

        if not reviewer:
            print("Reviewer profile not found.")
            return

        print(f"Found reviewer: {reviewer.id}. Current Channel ID: {reviewer.discord_channel_id}")
        
        # Clear the ID
        reviewer.discord_channel_id = None
        await db.commit()
        print("Cleared discord_channel_id. Bot should recreate channels on next loop.")

if __name__ == "__main__":
    asyncio.run(fix_channels())
