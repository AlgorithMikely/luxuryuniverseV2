from fastapi import HTTPException
from sqlalchemy.orm import Session
from sio_instance import sio
import asyncio
import security
from services import user_service, queue_service
from database import SessionLocal

@sio.on("connect")
async def connect(sid, environ, auth):
    if not auth or "token" not in auth:
        raise ConnectionRefusedError("Authentication failed")

    try:
        token_data = security.verify_token(auth["token"], HTTPException(status_code=401))
    except HTTPException:
        raise ConnectionRefusedError("Authentication failed")

    def db_operations():
        with SessionLocal() as db:
            user = user_service.get_user_by_discord_id(db, token_data.discord_id)
            if not user:
                raise ConnectionRefusedError("User not found")

            reviewer = queue_service.get_reviewer_by_user_id(db, user.id)
            return user, reviewer

    try:
        user, reviewer = await asyncio.to_thread(db_operations)
    except ConnectionRefusedError as e:
        print(f"Socket connection refused for sid {sid}: {e}")
        return False

    # Add user to a room for their own user-specific events
    await sio.enter_room(sid, f"user_room_{user.id}")

    # If the user is a reviewer, add them to their reviewer room
    if reviewer:
        await sio.enter_room(sid, f"reviewer_room_{reviewer.id}")

    print(f"Client connected: {sid}")
    return True
