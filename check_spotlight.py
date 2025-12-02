import asyncio
from sqlalchemy import select
from database import AsyncSessionLocal
from models import Submission

async def check_submissions():
    async with AsyncSessionLocal() as db:
        # Check total submissions
        result = await db.execute(select(Submission))
        all_subs = result.scalars().all()
        print(f"Total Submissions: {len(all_subs)}")

        # Check reviewed submissions
        result = await db.execute(select(Submission).where(Submission.review_score.isnot(None)))
        reviewed = result.scalars().all()
        print(f"Reviewed Submissions: {len(reviewed)}")

        # Check spotlighted submissions
        result = await db.execute(select(Submission).where(Submission.spotlighted == True))
        spotlighted = result.scalars().all()
        print(f"Spotlighted Submissions: {len(spotlighted)}")
        
        for s in spotlighted:
            print(f"Spotlighted: ID={s.id}, Title={s.track_title}, Score={s.review_score}")

if __name__ == "__main__":
    asyncio.run(check_submissions())
