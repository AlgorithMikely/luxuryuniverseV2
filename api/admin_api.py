from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
async def add_reviewer(
    reviewer_data: schemas.ReviewerCreate, db: Session = Depends(get_db)
):
    """Assign reviewer status to a user."""
    db_user = user_service.get_user_by_discord_id(db, reviewer_data.discord_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return user_service.add_reviewer_profile(
        db, user=db_user, channel_id=reviewer_data.discord_channel_id
    )

@router.delete("/reviewers/{reviewer_id}", status_code=204)
async def remove_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    """Remove reviewer status from a user."""
    success = user_service.remove_reviewer_profile(db, reviewer_id=reviewer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reviewer profile not found")
    return {"ok": True}
