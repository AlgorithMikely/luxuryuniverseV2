import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import socketio

from api import auth, reviewer_api, user_api, admin_api, proxy_api
import socket_handlers
from sio_instance import sio
from bot_main import bot

# Get the token from an environment variable
BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Code to run ON STARTUP ---
    print("FastAPI is starting up, logging in Discord bot...")

    if not BOT_TOKEN:
        print("Error: DISCORD_BOT_TOKEN environment variable is not set.")
        # Optionally, you could raise an error here to stop startup
    else:
        # 1. Create a background task to START the bot
        asyncio.create_task(bot.start(BOT_TOKEN))

        # 2. NOW, wait for it to be ready
        await bot.wait_until_ready()

        print("Discord bot is logged in and ready.")

    yield  # Your application is now running

    # --- Code to run ON SHUTDOWN ---
    if bot.is_ready():
        print("FastAPI is shutting down, logging out Discord bot...")
        await bot.close()
        print("Discord bot has been logged out.")

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
