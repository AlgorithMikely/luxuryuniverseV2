import asyncio
from database import AsyncSessionLocal
import models

async def main():
    async with AsyncSessionLocal() as db:
        # Check if config exists
        config = await db.get(models.PaymentConfig, 2) # Assuming ID is auto-inc, but actually it might not be 2. 
        # PaymentConfig ID is likely not same as Reviewer ID.
        # We need to filter by reviewer_id
        
        from sqlalchemy import select
        result = await db.execute(select(models.PaymentConfig).filter(models.PaymentConfig.reviewer_id == 2))
        config = result.scalars().first()
        
        if not config:
            print("Creating config for Reviewer 2")
            new_config = models.PaymentConfig(
                reviewer_id=2,
                provider="stripe",
                is_enabled=True,
                credentials={'stripe_account_id': 'acct_1SZucUUJRQcVPxtVh'} # Using same test account
            )
            db.add(new_config)
            await db.commit()
            print("Created.")
        else:
            print("Config exists.")

if __name__ == "__main__":
    asyncio.run(main())
