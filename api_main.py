import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import socketio

from api import auth, reviewer_api, user_api, admin_api, proxy_api, session_api, bot_api
import socket_handlers
from sio_instance import sio
from bot_main import bot, bot_ready # Import the bot and the ready event

# Get the token from an environment variable
BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Code to run ON STARTUP ---
    print("FastAPI is starting up, creating bot task...")

    if not BOT_TOKEN:
        print("CRITICAL: DISCORD_BOT_TOKEN environment variable is not set. Bot cannot start.")
        # Stop the application startup if the token is missing
        raise ValueError("DISCORD_BOT_TOKEN is not set")

    # 1. Create a background task to run the bot
    bot_task = asyncio.create_task(bot.start(BOT_TOKEN))

    # 2. Wait for the bot to signal that it's ready
    print("Waiting for Discord bot to log in and be ready...")
    await bot_ready.wait()

    print("Discord bot is ready. FastAPI application will now start.")

    yield  # Your application is now running

    # --- Code to run ON SHUTDOWN ---
    print("FastAPI is shutting down...")
    if bot.is_ready():
        print("Closing Discord bot connection...")
        await bot.close()
        print("Discord bot connection closed.")

    # Ensure the bot task is cancelled
    if 'bot_task' in locals() and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            print("Bot task successfully cancelled.")

# Create the main FastAPI app with the lifespan event handler
app = FastAPI(title="Universe Bot Main App", lifespan=lifespan)

# Include API routers
app.include_router(auth.router, prefix="/api")
app.include_router(reviewer_api.router, prefix="/api")
app.include_router(user_api.router, prefix="/api")
app.include_router(admin_api.router, prefix="/api")
app.include_router(proxy_api.router, prefix="/api")
app.include_router(session_api.router)
app.include_router(bot_api.router)

# Create the Socket.IO app and mount it
socket_app = socketio.ASGIApp(sio)
app.mount("/socket.io", socket_app)

@app.get("/")
def read_root():
    return {"Hello": "World from Root"}
