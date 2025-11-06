from fastapi import HTTPException
from sqlalchemy.orm import Session
from sio_instance import sio
import security
import schemas
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

    with SessionLocal() as db:
        # Use get_or_create_user to handle new users connecting
        user = user_service.get_or_create_user(db, token_data.discord_id, "New User") # A default name
        if not user:
            raise ConnectionRefusedError("Could not get or create user")

        # Add user to a room for their own user-specific events
        await sio.enter_room(sid, f"user_room_{user.id}")

        # If the user is a reviewer, add them to their reviewer room
        reviewer = queue_service.get_reviewer_by_user_id(db, user.id)
        if reviewer:
            await sio.enter_room(sid, f"reviewer_room_{reviewer.id}")

            # Send initial queue state to the connecting reviewer
            active_session = queue_service.get_active_session(db, reviewer.id)
            if active_session:
                queue = queue_service.get_sorted_queue(db, reviewer.id)
                queue_state = schemas.QueueState(
                    queue=[schemas.Submission.model_validate(s) for s in queue],
                    open_tiers=active_session.open_queue_tiers
                )
                await sio.emit("queue_updated", queue_state.model_dump(), to=sid)

    print(f"Client connected: {sid}")
    return True
