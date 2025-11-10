import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import socketio

import socket_handlers
from sio_instance import sio
from bot_main import bot, bot_ready

BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logging.info("FastAPI is starting up, creating bot task...")
    if not BOT_TOKEN:
        logging.critical("DISCORD_BOT_TOKEN environment variable is not set. Bot cannot start.")
        raise ValueError("DISCORD_BOT_TOKEN is not set")

    bot_task = asyncio.create_task(bot.start(BOT_TOKEN))
    logging.info("Waiting for Discord bot to log in and be ready...")
    await bot_ready.wait()
    logging.info("Discord bot is ready. FastAPI application will now start.")

    yield

    logging.info("FastAPI is shutting down...")
    if bot.is_ready():
        logging.info("Closing Discord bot connection...")
        await bot.close()
        logging.info("Discord bot connection closed.")

    if 'bot_task' in locals() and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            logging.info("Bot task successfully cancelled.")

def create_app():
    app = FastAPI(title="Universe Bot Main App", lifespan=lifespan)

    # Import and include routers here to avoid circular imports
    from api import auth, reviewer_api, user_api, admin_api, proxy_api, session_api
    app.include_router(auth.router, prefix="/api")
    app.include_router(reviewer_api.router, prefix="/api")
    app.include_router(user_api.router, prefix="/api")
    app.include_router(admin_api.router, prefix="/api")
    app.include_router(proxy_api.router, prefix="/api")
    app.include_router(session_api.router, prefix="/api/sessions", tags=["sessions"])

    socket_app = socketio.ASGIApp(sio)
    app.mount("/socket.io", socket_app)

    @app.get("/")
    def read_root():
        return {"Hello": "World from Root"}

    return app

app = create_app()
