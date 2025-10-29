from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session
import schemas
import security
from database import get_db
from services import queue_service, user_service

router = APIRouter(prefix="/{reviewer_id}", tags=["Reviewer"])

async def check_is_reviewer_or_admin(
    reviewer_id: int = Path(...),
    current_user: schemas.TokenData = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authorization check for reviewer-specific endpoints.
    Allows access if the current user is an admin, or if they are the
    specific reviewer who owns the queue.
    """
    # Admins have universal access to all reviewer queues
    if "admin" in current_user.roles:
        return current_user

    # If not an admin, check if the user is the designated reviewer for this queue
    if "reviewer" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reviewer")

    user = user_service.get_user_by_discord_id(db, current_user.discord_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    reviewer = queue_service.get_reviewer_by_user_id(db, user.id)

    if not reviewer or reviewer.id != reviewer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this queue")

    return current_user

# Apply the corrected dependency to all routes in this router
router.dependencies.append(Depends(check_is_reviewer_or_admin))

@router.get("/queue")
async def get_queue(reviewer_id: int, db: Session = Depends(get_db)):
    return queue_service.get_pending_queue(db, reviewer_id=reviewer_id)

@router.post("/queue/next")
async def next_track(reviewer_id: int, db: Session = Depends(get_db)):
    submission = await queue_service.advance_queue(db, reviewer_id=reviewer_id)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue is empty")
    return submission

@router.post("/queue/submission/{submission_id}/spotlight")
async def spotlight_submission(
    reviewer_id: int,
    submission_id: int,
    spotlight: bool,
    db: Session = Depends(get_db)
):
    submission = await queue_service.spotlight_submission(
        db,
        reviewer_id=reviewer_id,
        submission_id=submission_id,
        spotlight=spotlight
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission

@router.get("/queue/history")
async def get_queue_history(reviewer_id: int, db: Session = Depends(get_db)):
    return queue_service.get_played_queue(db, reviewer_id=reviewer_id)

@router.post("/queue/submission/{submission_id}/bookmark")
async def bookmark_submission(
    reviewer_id: int,
    submission_id: int,
    bookmark: bool,
    db: Session = Depends(get_db)
):
    submission = await queue_service.bookmark_submission(
        db,
        reviewer_id=reviewer_id,
        submission_id=submission_id,
        bookmark=bookmark
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return submission
