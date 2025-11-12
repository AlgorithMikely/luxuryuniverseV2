from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
import socketio
from bot_instance import bot
from config import settings
import socket_handlers
from sio_instance import sio

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    asyncio.create_task(bot.start(settings.DISCORD_TOKEN))
    # Yield control back to the application
    yield
    # Shutdown
    print("Shutting down...")
    await bot.close()

def create_app():
    app = FastAPI(title="Universe Bot Main App", lifespan=lifespan)

    # Import and include routers here to avoid circular imports
    from api import auth, reviewer_api, user_api, admin_api, proxy_api, session_api, spotify_api
    app.include_router(auth.router, prefix="/api")
    app.include_router(spotify_api.router, prefix="/api")
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
