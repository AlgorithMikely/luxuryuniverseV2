import asyncio
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import Submission

async def verify_data():
    async with AsyncSessionLocal() as db:
        print("--- Verifying Submission Data ---")
        result = await db.execute(select(Submission).order_by(Submission.id))
        submissions = result.scalars().all()
        
        if not submissions:
            print("No submissions found in the database.")
        
        for s in submissions:
            print(f"ID: {s.id}, ReviewerID: {s.reviewer_id}, Status: {s.status}, Bookmarked: {s.bookmarked}, Spotlighted: {s.spotlighted}")
            
        print("---------------------------------")

if __name__ == "__main__":
    try:
        asyncio.run(verify_data())
    except Exception as e:
        print(f"Error running verification: {e}")
