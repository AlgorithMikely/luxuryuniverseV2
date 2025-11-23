from fastapi import FastAPI
import socketio

import socket_handlers
from sio_instance import sio

def create_app():
    app = FastAPI(title="Universe Bot Main App")

    # Import and include routers here to avoid circular imports
    from api import auth, reviewer_api, user_api, admin_api, proxy_api, session_api, spotify_api, stripe_api, upload_api, achievements_api
    app.include_router(auth.router, prefix="/api")
    app.include_router(spotify_api.router, prefix="/api")
    app.include_router(reviewer_api.router, prefix="/api")
    app.include_router(user_api.router, prefix="/api")
    app.include_router(admin_api.router, prefix="/api")
    app.include_router(proxy_api.router, prefix="/api")
    app.include_router(session_api.router, prefix="/api/sessions", tags=["sessions"])
    app.include_router(stripe_api.router, prefix="/api")
    app.include_router(upload_api.router, prefix="/api")
    app.include_router(achievements_api.router, prefix="/api")

    # Serve uploads (local file storage for Smart-Zone)
    from fastapi.staticfiles import StaticFiles
    import os
    os.makedirs("uploads", exist_ok=True)
    app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")

    socket_app = socketio.ASGIApp(sio)
    app.mount("/socket.io", socket_app)

    @app.get("/")
    def read_root():
        return {"Hello": "World from Root"}

    return app

app = create_app()
