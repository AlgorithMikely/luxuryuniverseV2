from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import joinedload, selectinload
import json
import uuid
from typing import List, Optional
import os
import math
from collections import defaultdict

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

@router.get("/all", response_model=List[schemas.ReviewerProfile])
async def get_all_reviewers(db: AsyncSession = Depends(get_db)):
    """
    Returns a list of all reviewers.
    """
    result = await db.execute(
        select(models.Reviewer)
        .options(
            joinedload(models.Reviewer.user),
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
    )
    return result.scalars().all()



@router.get("/{reviewer_id}/queue", response_model=List[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def get_queue(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    return await queue_service.get_pending_queue(db, reviewer_id=reviewer_id)

@router.post("/{reviewer_id}/submit", response_model=List[schemas.Submission])
async def submit_smart(
    reviewer_id: int,
    submissions_json: str = Form(...), # JSON string for metadata
    files: List[UploadFile] = File(None), # Optional files
    email: Optional[str] = Form(None), # Required for guests
    tiktok_handle: Optional[str] = Form(None), # Optional for guests
    force_upload: bool = Form(False),
    reuse_hash: Optional[str] = Form(None),
    current_user: Optional[models.User] = Depends(security.get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Handles "Smart-Zone" submissions, including "Double Feature" linked submissions.
    Accepts a JSON payload (submissions_json) and optional files.
    """
    import hashlib

    # Handle Guest User
    if not current_user:
        if not email:
            raise HTTPException(status_code=401, detail="Authentication required or email must be provided for guest submission.")
        
        # Find or create guest user
        user = await user_service.get_or_create_guest_user(db, email, tiktok_handle)
        current_user = user

    try:
        payload_data = json.loads(submissions_json)
        payload = schemas.SmartSubmissionCreate(**payload_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")


    # 1. Verify Funds / Deduct Credits
    # Fetch reviewer settings for validation
    reviewer = await queue_service.get_reviewer_by_id(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    
    config = reviewer.configuration or {}

    # Check Free Line Limit
    free_line_limit = config.get("free_line_limit")
    if free_line_limit is not None:
        new_free_count = sum(1 for item in payload.submissions if item.priority_value == 0)
        if new_free_count > 0:
            pending_queue = await queue_service.get_pending_queue(db, reviewer_id)
            existing_free_count = sum(1 for s in pending_queue if s.priority_value == 0)
            
            if existing_free_count + new_free_count > free_line_limit:
                raise HTTPException(status_code=400, detail=f"Free line limit reached. Max {free_line_limit} active free submissions allowed.")

    # Check if tiers are open in active session
    active_session = await queue_service.get_active_session_by_reviewer(db, reviewer_id)
    if active_session:
        open_tiers = set(active_session.open_queue_tiers) if active_session.open_queue_tiers else set()
        # Ensure 0 is treated correctly if not explicitly in list but implied? 
        # Usually 0 is in the list if free line is open.
        
        for item in payload.submissions:
            if item.priority_value not in open_tiers:
                 raise HTTPException(status_code=400, detail=f"Queue tier {item.priority_value} is currently closed.")
    else:
        # No active session means all queues are closed? Or open?
        # Usually "closed" status means closed.
        # If queue_status is 'closed', we should block.
        if reviewer.queue_status == 'closed':
             raise HTTPException(status_code=400, detail="Queue is currently closed.")


    # Calculate Total Cost with Submissions Count Logic
    total_cost = 0
    
    # Group submissions by priority value
    submissions_by_priority = defaultdict(list)
    for item in payload.submissions:
        submissions_by_priority[item.priority_value].append(item)
        
    tiers = config.get("priority_tiers", [])
    # Convert tiers to dict for easy lookup: value -> tier
    tiers_map = {t["value"]: t for t in tiers}
    
    for priority_value, items in submissions_by_priority.items():
        if priority_value == 0:
            continue # Free is free
            
        tier = tiers_map.get(priority_value)
        count = len(items)
        
        # Check if tier has a bundle configuration
        submissions_per_bundle = 1
        if tier and isinstance(tier, dict):
             submissions_per_bundle = tier.get("submissions_count", 1)
        elif tier:
             # If tier is an object (Pydantic model), access attribute
             submissions_per_bundle = getattr(tier, "submissions_count", 1)
             
        if submissions_per_bundle > 1:
            bundles_needed = math.ceil(count / submissions_per_bundle)
            cost_for_group = bundles_needed * priority_value * 100
        else:
            cost_for_group = count * priority_value * 100
            
        total_cost += cost_for_group

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

    # Pre-fetch reused submission if hash provided
    reused_submission = None
    if reuse_hash:
        stmt = select(models.Submission).filter(models.Submission.file_hash == reuse_hash).order_by(desc(models.Submission.submitted_at))
        result = await db.execute(stmt)
        reused_submission = result.scalars().first()
        if not reused_submission:
            raise HTTPException(status_code=404, detail="Original submission for reuse not found")

    for item in payload.submissions:
        final_track_url = item.track_url
        final_file_hash = None

        # If it's a blob URL (from frontend preview), we expect a file upload OR a reuse
        if item.track_url.startswith("blob:"):
            
            if reused_submission:
                # Use existing URL and hash
                final_track_url = reused_submission.track_url
                final_file_hash = reused_submission.file_hash
                # Skip file_index increment as we aren't consuming a file (frontend shouldn't send one if reusing)
            
            elif files and file_index < len(files):
                uploaded_file = files[file_index]
                file_index += 1

                # Check file extension
                file_ext = os.path.splitext(uploaded_file.filename)[1].lower()
                if file_ext not in ALLOWED_EXTENSIONS:
                    raise HTTPException(status_code=400, detail=f"Invalid file type: {file_ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

                # Calculate Hash
                file_content = await uploaded_file.read()
                file_hash = hashlib.sha256(file_content).hexdigest()
                await uploaded_file.seek(0) # Reset for upload
                
                final_file_hash = file_hash

                # Check for duplicates
                if not force_upload:
                    stmt = select(models.Submission).filter(models.Submission.file_hash == file_hash).order_by(desc(models.Submission.submitted_at))
                    result = await db.execute(stmt)
                    existing = result.scalars().first()
                    
                    if existing:
                        # Construct duplicate info
                        duplicate_info = {
                            "message": "Duplicate file detected",
                            "hash": file_hash,
                            "existing_submission": {
                                "id": existing.id,
                                "track_title": existing.track_title,
                                "submitted_at": existing.submitted_at.isoformat() if existing.submitted_at else None
                            }
                        }
                        raise HTTPException(status_code=409, detail=json.dumps(duplicate_info))

                # Secure filename
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                
                # Upload to R2
                from services.storage_service import storage_service
                try:
                    # Reset file pointer just in case
                    await uploaded_file.seek(0)
                    final_track_url = await storage_service.upload_file(
                        uploaded_file.file, 
                        unique_filename, 
                        uploaded_file.content_type or "application/octet-stream"
                    )
                except Exception as e:
                    import logging
                    logging.error(f"R2 Upload failed: {e}")
                    raise HTTPException(status_code=500, detail="File upload failed. Please contact support.")
            else:
                # Blob URL but no file and no reuse?
                raise HTTPException(status_code=400, detail="Missing file for submission")

        # Log the hash being saved
        import logging
        logging.info(f"Creating submission with file_hash: {final_file_hash}")

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
            priority_value=item.priority_value,
            artist=item.artist,
            genre=item.genre,
            file_hash=final_file_hash
        )
        
        created_submissions.append(submission)
    
    # No need to commit here as create_submission commits
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

@router.post("/{reviewer_id}/queue/{submission_id}/play", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def play_track(reviewer_id: int, submission_id: int, db: AsyncSession = Depends(get_db)):
    """
    Sets a specific track as playing, resetting any other active track to pending.
    """
    submission = await queue_service.set_track_playing(db, reviewer_id=reviewer_id, submission_id=submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission

@router.get("/{reviewer_id}/queue/played", response_model=List[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def get_played_queue(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    return await queue_service.get_played_queue(db, reviewer_id=reviewer_id)

@router.get("/{reviewer_id}/queue/current", response_model=Optional[schemas.SubmissionPublic])
async def get_current_track_public(reviewer_id: int, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to get the currently playing track for a reviewer.
    Designed for OBS overlays and public widgets.

    Logic mirrors the frontend dashboard:
    1. Checks for a track explicitly marked as 'playing'.
    2. If none, falls back to the first track in the 'pending' queue.
    """
    # Set Cache-Control headers to prevent caching
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    # 1. Try getting explicitly playing track
    current = await queue_service.get_current_track(db, reviewer_id=reviewer_id)
    if current:
        return current

    # 2. Fallback to first pending track (Top of Queue)
    pending_queue = await queue_service.get_pending_queue(db, reviewer_id=reviewer_id)
    if pending_queue:
        return pending_queue[0]

    return None

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

@router.delete("/{reviewer_id}/queue/{submission_id}", dependencies=[Depends(check_is_reviewer)])
async def remove_submission(submission_id: int, db: AsyncSession = Depends(get_db)):
    submission = await queue_service.remove_submission(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"status": "success", "message": "Submission removed"}

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
            selectinload(models.Reviewer.payment_configs),
            selectinload(models.Reviewer.economy_configs)
        )
        .filter(models.Reviewer.id == reviewer_id)
    )
    reviewer = result.scalars().first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    # Merge config defaults
    reviewer = queue_service._merge_reviewer_config(reviewer)

    # Populate open_queue_tiers from active session
    active_session = await queue_service.get_active_session_by_reviewer(db, reviewer_id)
    if active_session:
        reviewer.open_queue_tiers = active_session.open_queue_tiers
    else:
        reviewer.open_queue_tiers = [] # All closed if no session

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
