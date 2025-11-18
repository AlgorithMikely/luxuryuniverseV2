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
