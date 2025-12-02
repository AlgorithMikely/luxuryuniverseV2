import pytest
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models import Base, User, Reviewer, Transaction
from services import user_service, economy_service
import asyncio

# Use an in-memory SQLite database for testing
DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
async def async_db_session():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.mark.anyio
async def test_add_coins_logging(async_db_session):
    # Setup
    user = await user_service.get_or_create_user(async_db_session, "123", "testuser")
    reviewer = Reviewer(user_id=user.id, discord_channel_id="456", tiktok_handle="test")
    async_db_session.add(reviewer)
    await async_db_session.commit()
    await async_db_session.refresh(reviewer)

    # Action
    await economy_service.add_coins(async_db_session, reviewer.id, user.id, 100, "Test Credit")

    # Verify DB
    balance = await economy_service.get_balance(async_db_session, reviewer.id, user.id)
    assert balance == 100

    # Verify Log File
    assert os.path.exists("transactions.log")
    with open("transactions.log", "r") as f:
        logs = f.readlines()
        last_log = logs[-1]
        assert "CREDIT" in last_log
        assert "Amount: 100" in last_log
        assert "Reason: Test Credit" in last_log

@pytest.mark.anyio
async def test_deduct_coins_logging(async_db_session):
    # Setup
    user = await user_service.get_or_create_user(async_db_session, "123", "testuser")
    reviewer = Reviewer(user_id=user.id, discord_channel_id="456", tiktok_handle="test")
    async_db_session.add(reviewer)
    await async_db_session.commit()
    await async_db_session.refresh(reviewer)

    # Add coins first
    await economy_service.add_coins(async_db_session, reviewer.id, user.id, 100, "Initial")

    # Action: Deduct
    await economy_service.deduct_coins(async_db_session, reviewer.id, user.id, 50, "Test Debit")

    # Verify DB
    balance = await economy_service.get_balance(async_db_session, reviewer.id, user.id)
    assert balance == 50

    # Verify Log File
    with open("transactions.log", "r") as f:
        logs = f.readlines()
        last_log = logs[-1]
        assert "DEBIT" in last_log
        assert "Amount: 50" in last_log
        assert "Reason: Test Debit" in last_log
