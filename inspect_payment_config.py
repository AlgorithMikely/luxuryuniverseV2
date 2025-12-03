import asyncio
from database import AsyncSessionLocal
from sqlalchemy import select
import models

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(models.PaymentConfig))
        configs = result.scalars().all()
        for config in configs:
            print(f"Reviewer: {config.reviewer_id}, Provider: {config.provider}, Enabled: {config.is_enabled}, Creds: {config.credentials}")

if __name__ == "__main__":
    asyncio.run(main())
