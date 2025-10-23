from fastapi import FastAPI
import socketio
from api import auth, reviewer_api, user_api
import socket_handlers
from sio_instance import sio

from fastapi import APIRouter

app = FastAPI(title="Universe Bot API")

# Create a root router for the API
api_router = APIRouter(prefix="/api")

socket_app = socketio.ASGIApp(sio)

api_router.include_router(auth.router)
api_router.include_router(reviewer_api.router)
api_router.include_router(user_api.router)

app.include_router(api_router)
app.mount("/", socket_app)


@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
