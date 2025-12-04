from fastapi import HTTPException
from sio_instance import sio
import security
from services import user_service, queue_service
from database import AsyncSessionLocal
import schemas

import logging

@sio.on("connect")
async def connect(sid, environ, auth):
    # Allow public connection if explicitly requested
    if auth and auth.get("is_public"):
        logging.info(f"Public client connected: {sid}")
        return True

    if not auth or "token" not in auth:
        logging.warning(f"Connection refused for {sid}: Missing token")
        raise ConnectionRefusedError("Authentication failed")

    try:
        token_data = security.verify_token(auth["token"], HTTPException(status_code=401))
    except HTTPException:
        logging.warning(f"Connection refused for {sid}: Invalid token")
        raise ConnectionRefusedError("Authentication failed")

    async with AsyncSessionLocal() as db:
        user = await user_service.get_user_by_discord_id(db, token_data.discord_id)
        if not user:
            logging.warning(f"Connection refused for {sid}: User {token_data.discord_id} not found in DB (Stale Token?)")
            raise ConnectionRefusedError("User not found")

        logging.info(f"Client connected: {sid}, User: {user.username} ({user.id})")

        # Add user to a room for their own user-specific events
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

    try:
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
                "queue": [s.model_dump(mode='json') for s in queue_schemas],
                "history": [s.model_dump(mode='json') for s in history_schemas],
                "bookmarks": [s.model_dump(mode='json') for s in bookmarks_schemas],
                "spotlight": [s.model_dump(mode='json') for s in spotlight_schemas],
                "current_track": current_track_schema.model_dump(mode='json') if current_track_schema else None,
            }
            await sio.emit("initial_state", initial_state, room=sid)
            logging.info(f"Emitted 'initial_state' for reviewer {reviewer_id} to {sid}")
    except Exception as e:
        logging.error(f"Error in join_reviewer_room: {e}")
        await sio.emit("error", {"message": f"Join failed: {str(e)}"}, room=sid)

@sio.on("ping")
async def ping(sid):
    await sio.emit("pong", {"message": "pong"}, room=sid)

@sio.on("join_global_room")
async def join_global_room(sid):
    """
    Allows a client to join the global room to receive app-wide updates.
    """
    room = "global_room"
    await sio.enter_room(sid, room)
    logging.info(f"Client {sid} joined room {room}")
