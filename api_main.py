import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
import socketio

from api import auth, reviewer_api, user_api, admin_api, proxy_api
import socket_handlers
from sio_instance import sio
from bot_main import main as bot_main_async
from bot_instance import bot

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the Discord bot and wait for it to be ready
    bot_task = asyncio.create_task(bot_main_async())
    await bot.wait_until_ready()
    yield
    # Cleanup: close the bot connection
    await bot.close()

# Create the main FastAPI app with the lifespan event handler
app = FastAPI(title="Universe Bot Main App", lifespan=lifespan)

# Include API routers
app.include_router(auth.router, prefix="/api")
app.include_router(reviewer_api.router, prefix="/api")
app.include_router(user_api.router, prefix="/api")
app.include_router(admin_api.router, prefix="/api")
app.include_router(proxy_api.router, prefix="/api")

# Create the Socket.IO app and mount it
socket_app = socketio.ASGIApp(sio)
app.mount("/socket.io", socket_app)

@app.get("/")
def read_root():
    return {"Hello": "World from Root"}
