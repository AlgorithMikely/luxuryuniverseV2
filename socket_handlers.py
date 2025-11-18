from fastapi import HTTPException
from sqlalchemy.orm import Session
from sio_instance import sio
import security
from services import user_service, queue_service
from database import SessionLocal
import schemas

import logging

@sio.on("connect")
async def connect(sid, environ, auth):
    if not auth or "token" not in auth:
        logging.warning(f"Connection refused for {sid}: Missing token")
        raise ConnectionRefusedError("Authentication failed")

    try:
        token_data = security.verify_token(auth["token"], HTTPException(status_code=401))
    except HTTPException:
        logging.warning(f"Connection refused for {sid}: Invalid token")
        raise ConnectionRefusedError("Authentication failed")

    with SessionLocal() as db:
        user = user_service.get_or_create_user(db, token_data.discord_id, token_data.username)
        if not user:
            logging.error(f"Could not get or create user for {sid} with discord_id {token_data.discord_id}")
            raise ConnectionRefusedError("Could not get or create user")

        logging.info(f"Client connected: {sid}, User: {user.username} ({user.id})")

        # Add user to a room for their own user-specific events
        user_room = f"user_room_{user.id}"
        await sio.enter_room(sid, user_room)
        logging.info(f"Added {sid} to room {user_room}")

        # If the user is a reviewer, add them to their reviewer room and send initial state
        reviewer = queue_service.get_reviewer_by_user_id(db, user.id)
        if reviewer:
            reviewer_room = f"reviewer_room_{reviewer.id}"
            await sio.enter_room(sid, reviewer_room)
            logging.info(f"Added {sid} to room {reviewer_room}")

            # Fetch initial queue and history
            pending_queue = queue_service.get_pending_queue(db, reviewer.id)
            played_history = queue_service.get_played_queue(db, reviewer.id)

            # Serialize data
            queue_schemas = [schemas.Submission.model_validate(s) for s in pending_queue]
            history_schemas = [schemas.Submission.model_validate(s) for s in played_history]

            # Emit the initial state to the connecting client
            initial_state = {
                "queue": [s.model_dump() for s in queue_schemas],
                "history": [s.model_dump() for s in history_schemas],
            }
            await sio.emit("initial_state", initial_state, room=sid)
            logging.info(f"Emitted 'initial_state' to {sid}")

    return True

@sio.on("disconnect")
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")
