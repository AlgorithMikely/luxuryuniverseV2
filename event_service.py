from sio_instance import sio

async def emit_queue_update(reviewer_id: int, queue_data: list):
    """Emits a queue update to the specified reviewer's room."""
    await sio.emit("queue_updated", queue_data, room=f"reviewer_room_{reviewer_id}")

async def emit_balance_update(reviewer_id: int, user_id: int, new_balance: int):
    """Emits a balance update to the specified user's room."""
    # A more granular room might be better here, but this works for now.
    await sio.emit(
        "balance_updated",
        {"new_balance": new_balance},
        room=f"user_room_{user_id}"
    )
