import pytest
from fastapi.testclient import TestClient
from httpx import Response, Request
from unittest.mock import patch
from api_main import app
from security import create_access_token
from models import User, Reviewer, Base
from database import SessionLocal, engine

client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_unauthorized_access(db_session):
    user = User(discord_id="1", username="test")
    db_session.add(user)
    db_session.commit()
    reviewer = Reviewer(user_id=user.id, discord_channel_id="1", tiktok_handle="test")
    db_session.add(reviewer)
    db_session.commit()

    response = client.get(f"/api/{reviewer.id}/queue")
    assert response.status_code == 401

@patch("httpx.AsyncClient.post")
@patch("httpx.AsyncClient.get")
def test_auth_callback(mock_get, mock_post, db_session):
    mock_post.return_value = Response(200, json={"access_token": "test_token"}, request=Request("POST", ""))
    mock_get.return_value = Response(200, json={"id": "1", "username": "test"}, request=Request("GET", ""))

    response = client.get("/api/auth/callback?code=test_code")
    assert len(response.history) == 1
    assert response.history[0].status_code == 307
    assert "token=" in response.history[0].headers["location"]

def test_reviewer_isolation(db_session):
    user1 = User(discord_id="2", username="user1")
    user2 = User(discord_id="3", username="user2")
    db_session.add_all([user1, user2])
    db_session.commit()

    reviewer1 = Reviewer(user_id=user1.id, discord_channel_id="2", tiktok_handle="reviewer1")
    reviewer2 = Reviewer(user_id=user2.id, discord_channel_id="3", tiktok_handle="reviewer2")
    db_session.add_all([reviewer1, reviewer2])
    db_session.commit()

    token1 = create_access_token(data={"sub": user1.discord_id, "roles": ["reviewer"]})

    # Accessing own queue should work
    response = client.get(f"/api/{reviewer1.id}/queue", headers={"Authorization": f"Bearer {token1}"})
    assert response.status_code == 200

    # Accessing other reviewer's queue should be forbidden
    response = client.get(f"/api/{reviewer2.id}/queue", headers={"Authorization": f"Bearer {token1}"})
    assert response.status_code == 403
