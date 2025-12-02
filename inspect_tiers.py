import asyncio
import os
import sys
from sqlalchemy import select

# Add project root to path
sys.path.append(os.getcwd())

from database import get_db
import models

async def inspect_tiers():
    async for db in get_db():
        # Query for reviewer
        result = await db.execute(select(models.Reviewer).where(models.Reviewer.tiktok_handle == "luxuryforbes"))
        reviewer = result.scalars().first()
        
        if not reviewer:
            print("Reviewer 'luxuryforbes' not found. Trying ID 1...")
            result = await db.execute(select(models.Reviewer).where(models.Reviewer.id == 1))
            reviewer = result.scalars().first()
            
        if not reviewer:
            print("No reviewer found.")
            return

        print(f"Reviewer: {reviewer.tiktok_handle} (ID: {reviewer.id})")
        
        config = reviewer.configuration
        if config:
            print("Configuration found.")
            tiers = config.get('priority_tiers', [])
            print("Priority Tiers:")
            for tier in tiers:
                print(tier)
        else:
            print("No configuration found.")
        
        break # Only need one session

if __name__ == "__main__":
    asyncio.run(inspect_tiers())
