from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import services.queue_service as queue_service
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/api/sessions",
    tags=["sessions"],
)

@router.post("", response_model=schemas.ReviewSession)
def create_session(db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    """
    Creates a new active session for the current reviewer, archiving the old one.
    """
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=403, detail="User is not a reviewer")

    reviewer_id = current_user.reviewer_profile.id

    # Archive the old active session
    active_session = queue_service.get_active_session(db, reviewer_id)
    if active_session:
        active_session.status = 'archived'
        db.commit()

    # Create a new active session
    new_session = queue_service.create_session(db, reviewer_id)
    return new_session

@router.post("/active/toggle-tier")
def toggle_tier(tier: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(get_current_user)):
    """
    Toggles a tier in the open_queue_tiers list for the current reviewer's active session.
    """
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=403, detail="User is not a reviewer")

    reviewer_id = current_user.reviewer_profile.id
    active_session = queue_service.get_active_session(db, reviewer_id)

    if not active_session:
        raise HTTPException(status_code=404, detail="No active session found")

    if tier in active_session.open_queue_tiers:
        active_session.open_queue_tiers.remove(tier)
    else:
        active_session.open_queue_tiers.append(tier)

    db.commit()
    db.refresh(active_session)
    return {"open_queue_tiers": active_session.open_queue_tiers}
