from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from bot_instance import bot as bot_instance
from database import get_db
import schemas
import security
from services import user_service

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(security.require_admin)],
)

@router.get("/reviewers", response_model=list[schemas.UserProfile])
async def get_all_reviewers(db: Session = Depends(get_db)):
    """Fetch all users with reviewer profiles."""
    return user_service.get_all_reviewers(db)


@router.delete("/reviewers/{reviewer_id}", status_code=204)
async def remove_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    """Remove reviewer status from a user."""
    success = user_service.remove_reviewer_profile(db, reviewer_id=reviewer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reviewer profile not found")
    return {"ok": True}

@router.get("/discord-users", response_model=list[schemas.DiscordUser])
async def get_discord_users(db: Session = Depends(get_db)):
    """Fetch all cached Discord users."""
    return user_service.get_all_discord_users(db)
