import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal
from models import AchievementDefinition

async def list_achievements():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AchievementDefinition))
        achievements = result.scalars().all()
        for ach in achievements:
            print(f"Slug: {ach.slug}, Name: {ach.display_name}, Desc: {ach.description}")

if __name__ == "__main__":
    asyncio.run(list_achievements())
