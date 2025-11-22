import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal
from models import TikTokAccount, Reviewer

async def check_handles():
    async with AsyncSessionLocal() as session:
        print("--- TikTokAccounts ---")
        stmt = select(TikTokAccount.handle_name)
        result = await session.execute(stmt)
        for handle in result.scalars():
            print(f"Account: '{handle}'")

        print("\n--- Reviewers ---")
        stmt = select(Reviewer.tiktok_handle)
        result = await session.execute(stmt)
        for handle in result.scalars():
            print(f"Reviewer: '{handle}'")

if __name__ == "__main__":
    asyncio.run(check_handles())
