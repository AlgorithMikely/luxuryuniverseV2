from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
import security
from database import get_db
from services import queue_service, user_service

router = APIRouter(tags=["Reviewer"])

async def check_is_reviewer(
    reviewer_id: int = Path(...),
    current_user: schemas.TokenData = Depends(security.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    import logging
    logging.warning(f"Checking reviewer access for reviewer_id: {reviewer_id}")
    logging.warning(f"Current user: {current_user}")

    # Admins have access to all reviewer routes.
    if "admin" in current_user.roles:
        logging.warning("User is an admin, granting access.")
        return current_user

    if "reviewer" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a reviewer")

    user = await user_service.get_user_by_discord_id(db, current_user.discord_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    reviewer = await queue_service.get_reviewer_by_user_id(db, user.id)

    if not reviewer or reviewer.id != reviewer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access this queue")

    return current_user

@router.get("/{reviewer_id}/queue", response_model=List[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def get_queue(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    return await queue_service.get_pending_queue(db, reviewer_id=reviewer_id)

@router.post("/{reviewer_id}/queue/next", response_model=Optional[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def next_track(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    submission = await queue_service.advance_queue(db, reviewer_id=reviewer_id)
    if not submission:
        return None
    return submission

@router.post("/{reviewer_id}/queue/return-active", dependencies=[Depends(check_is_reviewer)])
async def return_active(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    await queue_service.return_active_to_queue(db, reviewer_id=reviewer_id)
    return {"status": "success"}

@router.get("/{reviewer_id}/queue/played", response_model=List[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def get_played_queue(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    return await queue_service.get_played_queue(db, reviewer_id=reviewer_id)

@router.post("/{reviewer_id}/queue/review/{submission_id}", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def review_submission(submission_id: int, review: schemas.ReviewCreate, db: AsyncSession = Depends(get_db)):
    return await queue_service.review_submission(db, submission_id, review)

@router.post("/{reviewer_id}/queue/{submission_id}/bookmark", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def toggle_bookmark(submission_id: int, db: AsyncSession = Depends(get_db)):
    submission = await queue_service.toggle_bookmark(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission

@router.post("/{reviewer_id}/queue/{submission_id}/spotlight", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def toggle_spotlight(submission_id: int, db: AsyncSession = Depends(get_db)):
    submission = await queue_service.toggle_spotlight(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission

@router.post("/{reviewer_id}/queue/{submission_id}/priority", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def update_priority(submission_id: int, priority_value: int, db: AsyncSession = Depends(get_db)):
    submission = await queue_service.update_priority(db, submission_id, priority_value)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission

@router.get("/{reviewer_id}/queue/initial-state", response_model=schemas.FullQueueState, dependencies=[Depends(check_is_reviewer)])
async def get_initial_state(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Provides the full initial state for a reviewer's dashboard,
    useful for HTTP polling or initial page loads.
    """
    return await queue_service.get_initial_state(db, reviewer_id=reviewer_id)
