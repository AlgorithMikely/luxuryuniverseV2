import asyncio
from fastapi import FastAPI
import socketio
from api import auth, reviewer_api, user_api, admin_api
import socket_handlers
from sio_instance import sio
from bot_main import main as bot_main_async

# Create the main FastAPI app
app = FastAPI(title="Universe Bot Main App")

# Create a sub-application for the REST API
api_app = FastAPI(title="Universe Bot API")

# Include API routers in the sub-application
api_app.include_router(auth.router)
api_app.include_router(reviewer_api.router)
api_app.include_router(user_api.router)
api_app.include_router(admin_api.router)

# Create the Socket.IO app
socket_app = socketio.ASGIApp(sio)

# Mount the sub-applications
app.mount("/api", api_app)
app.mount("/", socket_app)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(bot_main_async())

@app.get("/")
def read_root():
    return {"Hello": "World from Root"}
