import asyncio
from fastapi import FastAPI, Depends, HTTPException
import socketio
from sqlalchemy.orm import Session

from api import auth, reviewer_api, user_api, admin_api
import socket_handlers
from sio_instance import sio
from bot_main import main as bot_main_async
from database import get_db
import schemas
import security
from services import user_service


# Create the main FastAPI app
app = FastAPI(title="Universe Bot Main App")

# Create a sub-application for the REST API
api_app = FastAPI(title="Universe Bot API")

@api_app.post("/admin/reviewers", response_model=schemas.UserProfile, tags=["Admin"], dependencies=[Depends(security.require_admin)])
async def add_reviewer(
    reviewer_data: schemas.ReviewerCreate, db: Session = Depends(get_db)
):
    """Assign reviewer status to a user."""
    db_user = user_service.get_user_by_discord_id(db, reviewer_data.discord_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # The bot's background task will detect the new reviewer and create channels.
    return user_service.add_reviewer_profile(
        db, user=db_user, tiktok_handle=reviewer_data.tiktok_handle
    )

# Include API routers in the sub-application
api_app.include_router(auth.router)
api_app.include_router(reviewer_api.router)
api_app.include_router(user_api.router)
api_app.include_router(admin_api.router)

# Create the Socket.IO app
socket_app = socketio.ASGIApp(sio)

# Mount the sub-applications
app.mount("/api", api_app)
app.mount("/", socket_app)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(bot_main_async())

@app.get("/")
def read_root():
    return {"Hello": "World from Root"}
