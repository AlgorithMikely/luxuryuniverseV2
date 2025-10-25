from fastapi import FastAPI
import socketio
from api import auth, reviewer_api, user_api, admin_api
import socket_handlers
from sio_instance import sio

from fastapi import APIRouter

app = FastAPI(title="Universe Bot API")

socket_app = socketio.ASGIApp(sio)

# Include API routers under the /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(reviewer_api.router, prefix="/api")
app.include_router(user_api.router, prefix="/api")
app.include_router(admin_api.router, prefix="/api")

app.mount("/", socket_app)


@app.get("/")
def read_root():
    return {"Hello": "World"}
