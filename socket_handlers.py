from fastapi import HTTPException
from sio_instance import sio
import security
from services import user_service, queue_service
from database import AsyncSessionLocal
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

    async with AsyncSessionLocal() as db:
        user = await user_service.get_or_create_user(db, token_data.discord_id, token_data.username)
        if not user:
            logging.error(f"Could not get or create user for {sid} with discord_id {token_data.discord_id}")
            raise ConnectionRefusedError("Could not get or create user")

        logging.info(f"Client connected: {sid}, User: {user.username} ({user.id})")

        # Add user to a room for their own user-specific events
        user_room = f"user_room_{user.id}"
        await sio.enter_room(sid, user_room)
        logging.info(f"Added {sid} to room {user_room}")

        # Note: We no longer automatically join the reviewer room here.
        # The client must explicitly emit 'join_reviewer_room' with the desired reviewer ID.

    return True

    return True

@sio.on("disconnect")
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")

@sio.on("join_reviewer_room")
async def join_reviewer_room(sid, reviewer_id):
    """
    Allows a client to join a specific reviewer's room to receive updates.
    Also sends the initial state for that reviewer.
    """
    try:
        reviewer_id = int(reviewer_id)
    except ValueError:
        logging.error(f"Invalid reviewer_id: {reviewer_id}")
        return

    room = f"reviewer_room_{reviewer_id}"
    await sio.enter_room(sid, room)
    logging.info(f"Client {sid} joined room {room}")

    async with AsyncSessionLocal() as db:
        # Fetch initial queue and history for the requested reviewer
        pending_queue = await queue_service.get_pending_queue(db, reviewer_id)
        played_history = await queue_service.get_played_queue(db, reviewer_id)
        bookmarks = await queue_service.get_bookmarked_submissions(db, reviewer_id)
        spotlight = await queue_service.get_spotlighted_submissions(db, reviewer_id)
        current_track = await queue_service.get_current_track(db, reviewer_id)

        # Serialize data
        queue_schemas = [schemas.Submission.model_validate(s) for s in pending_queue]
        history_schemas = [schemas.Submission.model_validate(s) for s in played_history]
        bookmarks_schemas = [schemas.Submission.model_validate(s) for s in bookmarks]
        spotlight_schemas = [schemas.Submission.model_validate(s) for s in spotlight]
        current_track_schema = schemas.Submission.model_validate(current_track) if current_track else None

        # Emit the initial state to the connecting client
        initial_state = {
            "queue": [s.model_dump() for s in queue_schemas],
            "history": [s.model_dump() for s in history_schemas],
            "bookmarks": [s.model_dump() for s in bookmarks_schemas],
            "spotlight": [s.model_dump() for s in spotlight_schemas],
            "current_track": current_track_schema.model_dump() if current_track_schema else None,
        }
        await sio.emit("initial_state", initial_state, room=sid)
        logging.info(f"Emitted 'initial_state' for reviewer {reviewer_id} to {sid}")
