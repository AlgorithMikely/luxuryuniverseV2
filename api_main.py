from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from api import auth, reviewer_api, user_api, admin_api
from api.proxy_api import router as proxy_router
import socket_handlers
from sio_instance import sio

app = FastAPI(title="Universe Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5177", "http://localhost:5178"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(sio)

# Include API routers under the /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(reviewer_api.router, prefix="/api")
app.include_router(user_api.router, prefix="/api")
app.include_router(admin_api.router, prefix="/api")
app.include_router(proxy_router, prefix="/api/proxy")


app.mount("/", socket_app)


@app.get("/")
def read_root():
    return {"Hello": "World"}
