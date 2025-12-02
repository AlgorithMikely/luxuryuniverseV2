import asyncio
from database import AsyncSessionLocal
from services import queue_service
import json

async def main():
    async with AsyncSessionLocal() as db:
        reviewer = await queue_service.get_reviewer_by_tiktok_handle(db, "luxuryforbes")
        if reviewer:
            print(f"Reviewer ID: {reviewer.id}")
            print(f"Configuration: {json.dumps(reviewer.configuration, indent=2)}")
            
            # Also check aiml.music just in case
            reviewer2 = await queue_service.get_reviewer_by_tiktok_handle(db, "aiml.music")
            if reviewer2:
                 print(f"Reviewer (aiml.music) ID: {reviewer2.id}")
                 print(f"Configuration: {json.dumps(reviewer2.configuration, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
