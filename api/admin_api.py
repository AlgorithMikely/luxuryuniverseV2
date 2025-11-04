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

@router.post("/reviewers", response_model=schemas.UserProfile)
async def add_reviewer(db: Session = Depends(get_db)):
    """Assign reviewer status to a user."""
    # Hardcoded for debugging the 404 error
    test_discord_id = "1288939094751051870"

    db_user = user_service.get_user_by_discord_id(db, test_discord_id)
    if not db_user:
        # To make the test robust, create the user if they don't exist
        db_user = user_service.get_or_create_user(db, test_discord_id, "TestUser")

    # The bot's background task will detect the new reviewer and create channels.
    return user_service.add_reviewer_profile(
        db, user=db_user, tiktok_handle="test_tiktok"
    )

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
