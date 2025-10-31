import socketio

# Define allowed origins for CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

sio = socketio.AsyncServer(
    async_mode="asgi"
)
