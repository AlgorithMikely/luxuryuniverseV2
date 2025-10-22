import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base, User, Reviewer, Transaction
from services import user_service, economy_service

# In-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Pytest fixture to provide a database session for each test
@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.mark.anyio
async def test_add_coins_creates_transaction_and_updates_wallet(db_session: Session):
    user = user_service.get_or_create_user(db_session, "123", "testuser")
    reviewer = Reviewer(user_id=user.id, discord_channel_id="456", tiktok_handle="test")
    db_session.add(reviewer)
    db_session.commit()

    await economy_service.add_coins(db_session, reviewer.id, user.id, 10, "Test")
    balance = economy_service.get_balance(db_session, reviewer.id, user.id)
    assert balance == 10

    transaction = db_session.query(Transaction).first()
    assert transaction.amount == 10
    assert transaction.reason == "Test"

def test_get_balance_on_new_user_returns_zero(db_session: Session):
    user = user_service.get_or_create_user(db_session, "123", "testuser")
    reviewer = Reviewer(user_id=user.id, discord_channel_id="456", tiktok_handle="test")
    db_session.add(reviewer)
    db_session.commit()

    balance = economy_service.get_balance(db_session, reviewer.id, user.id)
    assert balance == 0
