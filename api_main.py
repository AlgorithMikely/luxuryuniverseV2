from fastapi import FastAPI
import socketio
from api import auth, reviewer_api, user_api
import socket_handlers
from sio_instance import sio

app = FastAPI(title="Universe Bot API")

socket_app = socketio.ASGIApp(sio)

app.include_router(auth.router)
app.include_router(reviewer_api.router)
app.include_router(user_api.router)
app.mount("/ws", socket_app)


@app.get("/")
def read_root():
    return {"Hello": "World"}
