import asyncio
import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import models
from services import economy_service
from config import settings

# Setup DB
DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_session_metrics():
    async with AsyncSessionLocal() as db:
        # 1. Setup Data
        user = (await db.execute(select(models.User).limit(1))).scalars().first()
        reviewer = (await db.execute(select(models.Reviewer).limit(1))).scalars().first()
        
        if not user or not reviewer:
            print("Error: Need user and reviewer")
            return

        # Create a dummy session
        session = models.ReviewSession(
            reviewer_id=reviewer.id,
            name=f"Test Session {datetime.datetime.now().isoformat()}",
            is_active=True
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        print(f"Created Session: {session.id} - {session.name}")

        # Ensure user has credits
        user.credit_balance += 1000
        await db.commit()

        # 2. Process Transaction linked to Session
        credits_amount = 500
        print(f"Processing skip for {credits_amount} credits linked to session {session.id}...")
        await economy_service.process_skip_transaction(
            db, user.id, reviewer.id, credits_amount, "session_test", session_id=session.id
        )

        # 3. Verify Ledger
        stmt = select(models.TransactionLedger).order_by(models.TransactionLedger.timestamp.desc()).limit(1)
        ledger = (await db.execute(stmt)).scalars().first()
        
        print(f"Ledger Session ID: {ledger.session_id}")
        assert ledger.session_id == session.id, "Session ID not linked in ledger!"
        
        print("SUCCESS: Transaction linked to session correctly.")

if __name__ == "__main__":
    asyncio.run(test_session_metrics())
