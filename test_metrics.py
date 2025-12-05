import asyncio
import httpx
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import models
from services import economy_service
from decimal import Decimal

from config import settings

# Setup DB
DATABASE_URL = settings.SQLALCHEMY_DATABASE_URI
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_metrics():
    async with AsyncSessionLocal() as db:
        # 1. Create Dummy Data
        # Find a user and reviewer
        user = (await db.execute(select(models.User).limit(1))).scalars().first()
        reviewer = (await db.execute(select(models.Reviewer).limit(1))).scalars().first()
        
        if not user or not reviewer:
            print("Error: Need at least one user and one reviewer in DB")
            return

        print(f"Testing with User: {user.username} ({user.id}) and Reviewer: {reviewer.id}")

        # Ensure user has credits
        user.credit_balance += 1000
        await db.commit()

        # 2. Perform Skip Transaction
        credits_amount = 200
        print(f"Processing skip for {credits_amount} credits...")
        await economy_service.process_skip_transaction(db, user.id, reviewer.id, credits_amount, "test_skip")

        # 3. Verify Ledger
        stmt = select(models.TransactionLedger).order_by(models.TransactionLedger.timestamp.desc()).limit(1)
        ledger = (await db.execute(stmt)).scalars().first()
        
        expected_revenue = (Decimal(credits_amount) * economy_service.CREDIT_PRICE_USD) - ledger.usd_earned
        print(f"Ledger Entry ID: {ledger.id}")
        print(f"Credits Spent: {ledger.credits_spent}")
        print(f"USD Earned: {ledger.usd_earned}")
        print(f"Platform Revenue: {ledger.platform_revenue_usd}")
        print(f"Expected Revenue: {expected_revenue}")

        assert ledger.platform_revenue_usd == expected_revenue, "Revenue mismatch!"
        print("SUCCESS: Ledger revenue matches expected calculation.")

if __name__ == "__main__":
    asyncio.run(test_metrics())
