from sio_instance import sio
import logging

async def emit_queue_update(reviewer_id: int, queue_data: list):
    """Emits a queue update to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    logging.info(f"Emitting 'queue_updated' to room {room} with data: {queue_data}")
    await sio.emit("queue_updated", queue_data, room=room)
    logging.info("'queue_updated' event emitted.")

async def emit_history_update(reviewer_id: int, history_data: list):
    """Emits a history update to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    logging.info(f"Emitting 'history_updated' to room {room} with data: {history_data}")
    await sio.emit("history_updated", history_data, room=room)
    logging.info("'history_updated' event emitted.")

async def emit_balance_update(reviewer_id: int, user_id: int, new_balance: int):
    """Emits a balance update to the specified user's room."""
    # A more granular room might be better here, but this works for now.
    await sio.emit(
        "balance_updated",
        {"new_balance": new_balance},
        room=f"user_room_{user_id}"
    )

async def emit_current_track_update(reviewer_id: int, submission_data: dict | None):
    """Emits a current track update to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    logging.info(f"Emitting 'current_track_updated' to room {room} with data: {submission_data}")
    await sio.emit("current_track_updated", submission_data, room=room)
    logging.info("'current_track_updated' event emitted.")

async def emit_chat_message(reviewer_id: int, message_data: dict):
    """Emits a chat message to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    # logging.info(f"Emitting 'chat_message' to room {room}") # Optional: can be noisy
    await sio.emit("chat_message", message_data, room=room)

async def emit_giveaway_update(reviewer_id: int, giveaway_state: dict):
    """Emits a giveaway state update to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    # logging.info(f"Emitting 'giveaway_updated' to room {room} with data: {giveaway_state}")
    await sio.emit("giveaway_updated", giveaway_state, room=room)

async def emit_giveaway_winner(reviewer_id: int, winner_data: dict):
    """Emits a giveaway winner announcement to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    logging.info(f"Emitting 'giveaway_winner' to room {room} with data: {winner_data}")
    await sio.emit("giveaway_winner", winner_data, room=room)

async def emit_reviewer_settings_update(reviewer_id: int, settings_data: dict):
    """Emits a reviewer settings update to the specified reviewer's room."""
    room = f"reviewer_room_{reviewer_id}"
    logging.info(f"Emitting 'reviewer_settings_updated' to room {room}")
    await sio.emit("reviewer_settings_updated", settings_data, room=room)
