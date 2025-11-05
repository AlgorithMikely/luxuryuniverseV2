import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base, User, Reviewer, Submission, ReviewSession
from services import user_service, queue_service

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

def test_get_or_create_user(db_session: Session):
    # Test creating a new user
    user = user_service.get_or_create_user(db_session, "123", "testuser")
    assert user.discord_id == "123"
    assert user.username == "testuser"

    # Test retrieving an existing user
    user2 = user_service.get_or_create_user(db_session, "123", "testuser")
    assert user2.id == user.id

    # Test updating a user's username
    user3 = user_service.get_or_create_user(db_session, "123", "new_username")
    assert user3.username == "new_username"

def setup_reviewer_with_session(db_session: Session, user_id: str, username: str, channel_id: str, tiktok_handle: str) -> Reviewer:
    user = user_service.get_or_create_user(db_session, user_id, username)
    reviewer = Reviewer(user_id=user.id, discord_channel_id=channel_id, tiktok_handle=tiktok_handle)
    db_session.add(reviewer)
    db_session.commit()
    session = ReviewSession(reviewer_id=reviewer.id, status='active', name='Default')
    db_session.add(session)
    db_session.commit()
    return reviewer

@pytest.mark.anyio
async def test_create_submission(db_session: Session):
    reviewer = setup_reviewer_with_session(db_session, "123", "testuser", "456", "test")
    submission = await queue_service.create_submission(db_session, reviewer.id, reviewer.user_id, "http://test.com", "title", "url")
    assert submission.reviewer_id == reviewer.id
    assert submission.user_id == reviewer.user_id
    assert submission.track_url == "http://test.com"
    assert submission.session_id is not None

@pytest.mark.anyio
async def test_get_pending_queue(db_session: Session):
    reviewer = setup_reviewer_with_session(db_session, "123", "testuser", "456", "test")
    await queue_service.create_submission(db_session, reviewer.id, reviewer.user_id, "http://test.com", "title", "url")
    await queue_service.create_submission(db_session, reviewer.id, reviewer.user_id, "http://test2.com", "title", "url")
    queue = queue_service.get_pending_queue(db_session, reviewer.id)
    assert len(queue) == 2
    assert queue[0].track_url == "http://test.com"

@pytest.mark.anyio
async def test_reviewer_isolation(db_session: Session):
    reviewer1 = setup_reviewer_with_session(db_session, "1", "user1", "1", "reviewer1")
    reviewer2 = setup_reviewer_with_session(db_session, "2", "user2", "2", "reviewer2")
    await queue_service.create_submission(db_session, reviewer1.id, reviewer1.user_id, "reviewer1_track", "title", "url")
    await queue_service.create_submission(db_session, reviewer2.id, reviewer2.user_id, "reviewer2_track", "title", "url")
    queue1 = queue_service.get_pending_queue(db_session, reviewer1.id)
    assert len(queue1) == 1
    assert queue1[0].track_url == "reviewer1_track"
    queue2 = queue_service.get_pending_queue(db_session, reviewer2.id)
    assert len(queue2) == 1
    assert queue2[0].track_url == "reviewer2_track"

def test_set_queue_status(db_session: Session):
    user = user_service.get_or_create_user(db_session, "123", "testuser")
    reviewer = Reviewer(user_id=user.id, discord_channel_id="456", tiktok_handle="test")
    db_session.add(reviewer)
    db_session.commit()
    queue_service.set_queue_status(db_session, reviewer.id, "open")
    assert reviewer.queue_status == "open"

@pytest.mark.anyio
async def test_advance_queue(db_session: Session):
    reviewer = setup_reviewer_with_session(db_session, "123", "testuser", "456", "test")
    await queue_service.create_submission(db_session, reviewer.id, reviewer.user_id, "track1", "title", "url")
    await queue_service.create_submission(db_session, reviewer.id, reviewer.user_id, "track2", "title", "url")
    submission = await queue_service.advance_queue(db_session, reviewer.id)
    assert submission.status == "played"
    assert submission.track_url == "track1"

    submission2 = await queue_service.advance_queue(db_session, reviewer.id)
    assert submission2.status == "played"
    assert submission2.track_url == "track2"

    assert await queue_service.advance_queue(db_session, reviewer.id) is None
