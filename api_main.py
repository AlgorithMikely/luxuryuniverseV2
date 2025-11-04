import asyncio
from fastapi import FastAPI
import socketio

from api import auth, reviewer_api, user_api, admin_api
import socket_handlers
from sio_instance import sio
from bot_main import main as bot_main_async

# Create the main FastAPI app
app = FastAPI(title="Universe Bot Main App")

# Include API routers directly in the main app with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(reviewer_api.router, prefix="/api")
app.include_router(user_api.router, prefix="/api")
app.include_router(admin_api.router, prefix="/api")

# Create the Socket.IO app and mount it at /socket.io
socket_app = socketio.ASGIApp(sio)
app.mount("/socket.io", socket_app)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(bot_main_async())

@app.get("/")
def read_root():
    return {"Hello": "World from Root"}