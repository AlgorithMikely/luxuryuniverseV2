from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import json
import uuid
from typing import List, Optional
import os

import models
import schemas
import security
from database import get_db
from services import economy_service, user_service, queue_service

router = APIRouter(prefix="/reviewer", tags=["Reviewer"])

async def check_is_reviewer(
    reviewer_id: int,
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

@router.post("/{reviewer_id}/submit", response_model=List[schemas.Submission])
async def submit_smart(
    reviewer_id: int,
    submissions_json: str = Form(...), # JSON string for metadata
    files: List[UploadFile] = File(None), # Optional files
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Handles "Smart-Zone" submissions, including "Double Feature" linked submissions.
    Accepts a JSON payload (submissions_json) and optional files.
    """
    try:
        payload_data = json.loads(submissions_json)
        payload = schemas.SmartSubmissionCreate(**payload_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")

    # 1. Verify Funds / Deduct Credits
    total_cost = 0
    for item in payload.submissions:
        total_cost += item.priority_value

    if total_cost > 0:
        current_balance = await economy_service.get_balance(db, reviewer_id, current_user.id)
        if current_balance < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Required: {total_cost}, Available: {current_balance}")

        # Deduct coins
        await economy_service.add_coins(db, reviewer_id, current_user.id, -total_cost, "submission_fee")

    # 2. Handle Files and Create Submissions
    # Generate a batch_id if multiple submissions or just for consistency
    batch_id = str(uuid.uuid4()) if len(payload.submissions) > 1 else None

    created_submissions = []

    file_index = 0

    # Allowed extensions for security
    ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}

    for item in payload.submissions:
        final_track_url = item.track_url

        # If it's a blob URL (from frontend preview), we expect a file upload
        if item.track_url.startswith("blob:") and files and file_index < len(files):
            uploaded_file = files[file_index]
            file_index += 1

            # Check file extension
            file_ext = os.path.splitext(uploaded_file.filename)[1].lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"Invalid file type: {file_ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

            # Save file locally
            # We need a 'uploads' directory.
            upload_dir = "uploads"
            os.makedirs(upload_dir, exist_ok=True)

            # Secure filename
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            file_path = os.path.join(upload_dir, unique_filename)

            with open(file_path, "wb") as f:
                content = await uploaded_file.read()
                f.write(content)

            # Construct public URL
            final_track_url = f"/api/uploads/{unique_filename}"

        submission = await queue_service.create_submission(
            db=db,
            reviewer_id=reviewer_id,
            user_id=current_user.id,
            track_url=final_track_url,
            track_title=item.track_title or "Untitled",
            archived_url=None,
            session_id=None,
            batch_id=batch_id,
            sequence_order=item.sequence_order,
            hook_start_time=item.hook_start_time,
            hook_end_time=item.hook_end_time,
            priority_value=item.priority_value
        )
        created_submissions.append(submission)

    return created_submissions


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

@router.get("/{reviewer_id}/settings", response_model=schemas.ReviewerProfile)
async def get_reviewer_settings(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    # Note: Removed check_is_reviewer dependency to allow public access to reviewer settings
    # (e.g., for fetching priority tiers on the submission page).

    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs)
        )
        .filter(models.Reviewer.id == reviewer_id)
    )
    reviewer = result.scalars().first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # Merge config defaults
    reviewer = queue_service._merge_reviewer_config(reviewer)

    # TODO: Mask payment credentials if not authorized?

    return reviewer

@router.patch("/{reviewer_id}/settings", response_model=schemas.ReviewerProfile, dependencies=[Depends(check_is_reviewer)])
async def update_reviewer_settings(reviewer_id: int, settings: schemas.ReviewerSettingsUpdate, db: AsyncSession = Depends(get_db)):
    updated_reviewer = await queue_service.update_reviewer_settings(db, reviewer_id, settings)
    if not updated_reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return updated_reviewer

@router.get("/{reviewer_id}/stats", response_model=schemas.QueueStats)
async def get_reviewer_stats(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    # Removed check_is_reviewer so public submission page can see queue stats
    return await queue_service.get_reviewer_stats(db, reviewer_id)

@router.post("/{reviewer_id}/queue/status", response_model=schemas.QueueStats, dependencies=[Depends(check_is_reviewer)])
async def set_queue_status(reviewer_id: int, status_update: schemas.QueueStatusUpdate, db: AsyncSession = Depends(get_db)):
    # Update the status
    await queue_service.set_queue_status(db, reviewer_id, status_update.status)
    # Return updated stats
    return await queue_service.get_reviewer_stats(db, reviewer_id)
