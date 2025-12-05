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
from services import economy_service, user_service, queue_service, media_service

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
    reviewers = result.scalars().all()
    
    # Get active live sessions to populate is_live
    stmt_live = select(models.LiveSession.user_id).where(models.LiveSession.status == 'LIVE')
    result_live = await db.execute(stmt_live)
    live_user_ids = set(result_live.scalars().all())

    enriched_reviewers = []
    for r in reviewers:
        profile = await media_service.enrich_reviewer_profile(r)
        profile.is_live = r.user_id in live_user_ids
        enriched_reviewers.append(profile)
        
    return enriched_reviewers



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
        if not tiktok_handle:
            raise HTTPException(status_code=400, detail="TikTok handle is required for submission.")
        
        # Find or create guest user
        user = await user_service.get_or_create_guest_user(db, email, tiktok_handle)
        current_user = user
    else:
        # Ensure logged-in user has a TikTok handle
        if not current_user.tiktok_username:
            if not tiktok_handle:
                raise HTTPException(status_code=400, detail="Please provide your TikTok handle to link it to your account.")
            
            # Update user profile
            # We need to ensure uniqueness or handle conflicts? 
            # user_service.update_user? Or just direct update.
            # Direct update for now, assuming unique constraint will raise IntegrityError if duplicate.
            # But wait, if they provide a handle that is already taken by another user?
            # We should probably check.
            existing_user = await user_service.get_user_by_tiktok_username(db, tiktok_handle)
            if existing_user and existing_user.id != current_user.id:
                 raise HTTPException(status_code=409, detail="This TikTok handle is already linked to another account.")

            current_user.tiktok_username = tiktok_handle
            db.add(current_user)
            await db.commit()
            await db.refresh(current_user)

            # Link TikTokAccount and transfer pending coins if any
            # We need to import models here or use existing imports
            # Check for existing TikTokAccount
            stmt_account = select(models.TikTokAccount).where(models.TikTokAccount.unique_id == tiktok_handle)
            result_account = await db.execute(stmt_account)
            tiktok_account = result_account.scalar_one_or_none()
            
            if tiktok_account:
                tiktok_account.user_id = current_user.id
                
                if tiktok_account.pending_coins > 0:
                    # Award pending coins
                    # We need economy_service
                    # And a reviewer_id. We can use the current reviewer_id from the request.
                    try:
                        await economy_service.purchase_credits(db, current_user.id, tiktok_account.pending_coins, 0.0, "tiktok_reward", "retroactive")
                        tiktok_account.pending_coins = 0
                    except Exception as e:
                        logging.error(f"Failed to transfer pending coins: {e}")
                
                db.add(tiktok_account)
                await db.commit()

    import logging
    try:
        payload_data = json.loads(submissions_json)
        payload = schemas.SmartSubmissionCreate(**payload_data)
        logging.info(f"Processing submission for user {current_user.id if current_user else 'Guest'}")
    except Exception as e:
        logging.error(f"JSON Parse Error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")


    # 1. Verify Funds / Deduct Credits
    # Fetch reviewer settings for validation
    reviewer = await queue_service.get_reviewer_by_id(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    
    config = reviewer.configuration or {}

    # Check if tiers are open in active session
    active_session = await queue_service.get_active_session_by_reviewer(db, reviewer_id)

    # Check Free Line Limit (REMOVED - Queue Cap is no longer enforced)
    # free_line_limit = config.get("free_line_limit")
    # if free_line_limit is not None:
    #     new_free_count = sum(1 for item in payload.submissions if item.priority_value == 0)
    #     if new_free_count > 0:
    #         pending_queue = await queue_service.get_pending_queue(db, reviewer_id)
    #         existing_free_count = sum(1 for s in pending_queue if s.priority_value == 0)
    #         
    #         if existing_free_count + new_free_count > free_line_limit:
    #             raise HTTPException(status_code=400, detail=f"Free line limit reached. Max {free_line_limit} active free submissions allowed.")

    # Check Max Free Submissions Per Session
    max_free_session = config.get("max_free_submissions_session")
    if max_free_session is not None:
        new_free_count = sum(1 for item in payload.submissions if item.priority_value == 0)
        if new_free_count > 0 and active_session:
            # Count total free submissions for this session
            stmt = select(func.count(models.Submission.id)).where(
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.session_id == active_session.id,
                models.Submission.priority_value == 0
            )
            result = await db.execute(stmt)
            current_session_free_count = result.scalar() or 0
            
            if current_session_free_count + new_free_count > max_free_session:
                raise HTTPException(status_code=400, detail=f"Session limit reached. Max {max_free_session} free submissions allowed per session.")

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
            cost_for_group = bundles_needed * priority_value * reviewer.skip_price_credits
        else:
            cost_for_group = count * priority_value * reviewer.skip_price_credits
            
        total_cost += cost_for_group

    if total_cost > 0:
        # Check global credit balance
        current_balance = await economy_service.get_user_credit_balance(db, current_user.id)
        if current_balance < total_cost:
            raise HTTPException(status_code=402, detail=f"Insufficient balance. Required: {total_cost}, Available: {current_balance}")

        # Process Atomic Transaction (Deduct Credits -> Credit Reviewer USD)
        try:
            session_id = active_session.id if active_session else None
            await economy_service.process_skip_transaction(db, current_user.id, reviewer_id, total_cost, "submission_fee", session_id=session_id)
        except ValueError as e:
            raise HTTPException(status_code=402, detail=f"Transaction failed: {str(e)}")
        except Exception as e:
            import logging
            logging.error(f"Payment processing failed: {e}")
            raise HTTPException(status_code=500, detail="Payment processing failed. Please contact support.")

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
                    stmt = select(models.Submission).options(joinedload(models.Submission.session)).filter(
                        models.Submission.file_hash == file_hash,
                        models.Submission.user_id == current_user.id,
                        models.Submission.reviewer_id == reviewer_id
                    ).order_by(desc(models.Submission.submitted_at))
                    result = await db.execute(stmt)
                    existing = result.scalars().first()
                    
                    if existing:
                        # Check if currently active
                        # FIXED: Only consider it active if the session is ALSO active (or if it has no session, which shouldn't happen for queue items usually)
                        is_active = existing.status in ['pending', 'playing']
                        
                        import logging
                        logging.warning(f"DEBUG DUPLICATE CHECK (FILE): ID={existing.id}, Status={existing.status}, Session={existing.session}, SessionActive={existing.session.is_active if existing.session else 'None'}")

                        if is_active:
                            # Check 1: Explicit Session Inactivity
                            if existing.session and not existing.session.is_active:
                                logging.warning("DEBUG: Ignoring duplicate because linked session is inactive.")
                                is_active = False
                            
                            # Check 2: Timestamp (Ghost from previous session)
                            # If existing has no session (legacy/bug) AND is older than current active session
                            elif not existing.session and active_session and existing.submitted_at < active_session.created_at:
                                logging.warning("DEBUG: Ignoring duplicate because it is older than current active session.")
                                is_active = False

                        if is_active:
                            # Construct duplicate info
                            duplicate_info = {
                                "message": "Track already in queue",
                                "type": "file",
                                "hash": file_hash,
                                "is_active": is_active,
                                "existing_submission": {
                                    "id": existing.id,
                                    "track_title": existing.track_title,
                                    "status": existing.status,
                                    "submitted_at": existing.submitted_at.isoformat() if existing.submitted_at else None
                                }
                            }
                            raise HTTPException(status_code=409, detail=json.dumps(duplicate_info))
                        else:
                            # Not active? Reuse hash silently!
                            final_file_hash = file_hash
                            # Skip R2 upload logic
                            uploaded_file = None # Prevent upload block from running
                            final_track_url = existing.track_url # Reuse URL too if possible, or we rely on hash? 
                            # Actually we need the URL. If we reuse hash, we should reuse the URL associated with that hash if we want to avoid re-uploading.
                            # But wait, the existing submission has the URL.
                            final_track_url = existing.track_url

                # Secure filename
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                
                # Upload to R2
                if uploaded_file:
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
        
        else:
            # Link Submission (not blob)
            if not force_upload:
                # Check for duplicate URL for this user
                stmt = select(models.Submission).options(joinedload(models.Submission.session)).filter(
                    models.Submission.user_id == current_user.id,
                    models.Submission.track_url == item.track_url,
                    models.Submission.reviewer_id == reviewer_id
                ).order_by(desc(models.Submission.submitted_at))
                result = await db.execute(stmt)
                existing = result.scalars().first()

                if existing:
                    is_active = existing.status in ['pending', 'playing']
                    
                    import logging
                    logging.warning(f"DEBUG DUPLICATE CHECK (LINK): ID={existing.id}, Status={existing.status}, Session={existing.session}, SessionActive={existing.session.is_active if existing.session else 'None'}")

                    # FIXED: Check session activity
                    if is_active:
                        # Check 1: Explicit Session Inactivity
                        if existing.session and not existing.session.is_active:
                            logging.warning("DEBUG: Ignoring duplicate because linked session is inactive.")
                            is_active = False
                        
                        # Check 2: Timestamp (Ghost from previous session)
                        elif not existing.session and active_session and existing.submitted_at < active_session.created_at:
                            logging.warning("DEBUG: Ignoring duplicate because it is older than current active session.")
                            is_active = False
                    
                    if is_active:
                        duplicate_info = {
                            "message": "Track already in queue",
                            "type": "link",
                            "track_url": item.track_url,
                            "is_active": is_active,
                            "existing_submission": {
                                "id": existing.id,
                                "track_title": existing.track_title,
                                "status": existing.status,
                                "submitted_at": existing.submitted_at.isoformat() if existing.submitted_at else None
                            }
                        }
                        raise HTTPException(status_code=409, detail=json.dumps(duplicate_info))
                    else:
                        # Not active? Reuse silently.
                        # For links, we don't need to do anything special, just let it proceed to create a new submission
                        # with the same URL.
                        pass

        # Final check before creating: Ensure we aren't creating a duplicate active submission via reuse/force
        # (If force_upload is True, we allow it, assuming user knows what they are doing or it's a new version)
        # But if reuse_hash is used, we should double check.
        if reuse_hash or (not files and not item.track_url.startswith("blob:")):
             # Check if we are about to create a duplicate pending submission
             check_hash = final_file_hash or (reused_submission.file_hash if reused_submission else None)
             check_url = final_track_url
             
             stmt = select(models.Submission).options(joinedload(models.Submission.session)).filter(
                models.Submission.user_id == current_user.id,
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.status.in_(['pending', 'playing'])
             )
             
             if check_hash:
                 stmt = stmt.filter(models.Submission.file_hash == check_hash)
             else:
                 stmt = stmt.filter(models.Submission.track_url == check_url)
                 
             result = await db.execute(stmt)
             active_dup = result.scalars().first()
             
             if active_dup and not force_upload:
                  # FIXED: Check session activity
                  is_active_dup = True
                  if active_dup.session and not active_dup.session.is_active:
                      is_active_dup = False
                  elif not active_dup.session and active_session and active_dup.submitted_at < active_session.created_at:
                      is_active_dup = False
                  
                  if is_active_dup:
                      raise HTTPException(status_code=400, detail="This track is already in the queue.")

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
            session_id=active_session.id if active_session else None,
            batch_id=batch_id,
            sequence_order=item.sequence_order,
            hook_start_time=item.hook_start_time,
            hook_end_time=item.hook_end_time,
            priority_value=item.priority_value,
            artist=item.artist,
            genre=item.genre,
            file_hash=final_file_hash,
            cover_art_url=item.cover_art_url,
            note=item.note
        )
        
        created_submissions.append(submission)
    
    # --- ACHIEVEMENT TRIGGERS ---
    # We do this after the loop to batch updates or just check once per batch
    try:
        from services import achievement_service
        
        # 1. Submission Count
        # Get total count
        count_stmt = select(func.count()).select_from(models.Submission).filter(models.Submission.user_id == current_user.id)
        res_count = await db.execute(count_stmt)
        total_submissions = res_count.scalar() or 0
        await achievement_service.trigger_achievement(db, current_user.id, "SUBMISSION_COUNT", value=total_submissions)

        # 2. Metadata Tags & Link Types
        for item in payload.submissions:
            title = (item.track_title or "").lower()
            url = (item.track_url or "").lower()

            # Producer Tag
            if "(prod." in title:
                await achievement_service.trigger_achievement(db, current_user.id, "METADATA_TAG", specific_slug="producer_tag")
            
            # Collaborator
            if "feat." in title or "ft." in title:
                await achievement_service.trigger_achievement(db, current_user.id, "METADATA_TAG", specific_slug="collaborator")

            # SoundCloud Rapper
            if "soundcloud.com" in url:
                await achievement_service.trigger_achievement(db, current_user.id, "LINK_TYPE", specific_slug="soundcloud_rapper")

            # DSP Pro
            if "spotify.com" in url or "music.apple.com" in url:
                await achievement_service.trigger_achievement(db, current_user.id, "LINK_TYPE", specific_slug="dsp_pro")

    except Exception as e:
        import logging
        logging.error(f"Failed to trigger achievements on submission: {e}")

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

    import logging
    # 1. Try getting explicitly playing track
    current = await queue_service.get_current_track(db, reviewer_id=reviewer_id)
    if current:
        logging.info(f"get_current_track_public: Found active track {current.id} (Title: {current.track_title})")
        return current

    # 2. Fallback to first pending track (Top of Queue)
    pending_queue = await queue_service.get_pending_queue(db, reviewer_id=reviewer_id)
    if pending_queue:
        logging.info(f"get_current_track_public: No active track, falling back to pending queue top: {pending_queue[0].id}")
        return pending_queue[0]

    logging.info("get_current_track_public: No active or pending tracks.")
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

@router.get("/{reviewer_id}/bookmarks", response_model=List[schemas.Submission], dependencies=[Depends(check_is_reviewer)])
async def get_bookmarks(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetches all bookmarked submissions for a reviewer.
    """
    return await queue_service.get_bookmarked_submissions(db, reviewer_id)

@router.patch("/{reviewer_id}/queue/{submission_id}", response_model=schemas.Submission, dependencies=[Depends(check_is_reviewer)])
async def update_submission(reviewer_id: int, submission_id: int, update_data: schemas.SubmissionUpdate, db: AsyncSession = Depends(get_db)):
    """
    Updates submission details, such as tags (playlists).
    """
    submission = await queue_service.update_submission_details(db, submission_id, update_data)
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
    
    return await media_service.enrich_reviewer_profile(reviewer)

@router.get("/public/{identifier}", response_model=schemas.ReviewerProfile)
async def get_public_reviewer_profile(identifier: str, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to fetch reviewer profile by ID or TikTok handle.
    """
    reviewer = None
    
    # Try as ID first
    if identifier.isdigit():
        reviewer = await queue_service.get_reviewer_by_id(db, int(identifier))
    
    # If not found or not ID, try as TikTok handle
    if not reviewer:
        reviewer = await queue_service.get_reviewer_by_tiktok_handle(db, identifier)
        
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
        
    # Merge config defaults
    reviewer = queue_service._merge_reviewer_config(reviewer)

    # Populate open_queue_tiers from active session
    active_session = await queue_service.get_active_session_by_reviewer(db, reviewer.id)
    if active_session:
        reviewer.open_queue_tiers = active_session.open_queue_tiers
    else:
        reviewer.open_queue_tiers = []

    return await media_service.enrich_reviewer_profile(reviewer)

@router.get("/{reviewer_id}/giveaway/state", response_model=Optional[schemas.GiveawayState])
async def get_public_giveaway_state(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to fetch the current giveaway state.
    """
    # Verify reviewer exists
    reviewer = await queue_service.get_reviewer_by_id(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
        
    return await queue_service.get_giveaway_state(db, reviewer_id)

@router.patch("/{reviewer_id}/settings", response_model=schemas.ReviewerProfile, dependencies=[Depends(check_is_reviewer)])
async def update_reviewer_settings(reviewer_id: int, settings: schemas.ReviewerSettingsUpdate, db: AsyncSession = Depends(get_db)):
    # Fetch current reviewer to check for handle changes
    current_reviewer = await queue_service.get_reviewer_by_id(db, reviewer_id)
    old_handle = current_reviewer.tiktok_handle if current_reviewer else None

    updated_reviewer = await queue_service.update_reviewer_settings(db, reviewer_id, settings)
    if not updated_reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    
    # Check if TikTok handle changed and update monitoring dynamically
    new_handle = updated_reviewer.tiktok_handle
    
    # Normalize for comparison (handle None)
    old_h_norm = old_handle.lower() if old_handle else ""
    new_h_norm = new_handle.lower() if new_handle else ""

    if old_h_norm != new_h_norm:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"TikTok handle changed from {old_handle} to {new_handle}. Updating monitoring...")
        
        from bot_instance import bot
        if bot and bot.is_ready():
            tiktok_cog = bot.get_cog("TikTokCog")
            if tiktok_cog:
                # Stop tracking old handle
                if old_handle:
                    await tiktok_cog.update_monitoring(old_handle, False)
                # Start tracking new handle
                if new_handle:
                    await tiktok_cog.update_monitoring(new_handle, True)
            else:
                logger.error("TikTokCog not found when updating reviewer handle")
        else:
             logger.warning("Bot not ready or not found when updating reviewer handle")

    return await media_service.enrich_reviewer_profile(updated_reviewer)

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

@router.post("/{reviewer_id}/sync-avatar", response_model=schemas.ReviewerProfile, dependencies=[Depends(check_is_reviewer)])
async def sync_reviewer_avatar(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Syncs the reviewer's avatar from their linked Discord server.
    """
    reviewer = await queue_service.get_reviewer_by_id(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    if not reviewer.discord_channel_id:
        raise HTTPException(status_code=400, detail="No Discord channel linked to this reviewer.")

    # We need to fetch the avatar URL via the Bot
    # Since the bot runs in a separate thread/process, we need a way to communicate.
    # We can use the 'bot_instance' if available in the same process, or an IPC mechanism.
    # In this codebase, 'bot_instance.bot' is available.

    from bot_instance import bot
    import asyncio

    if not bot.is_ready():
         raise HTTPException(status_code=503, detail="Discord bot is not ready")

    try:
        # Run in executor to avoid blocking async loop if bot calls are blocking (they shouldn't be, but just in case)
        # However, bot.get_channel is synchronous/cache-based.
        channel = bot.get_channel(int(reviewer.discord_channel_id))
        if not channel:
             # Try fetching if not in cache
             try:
                channel = await bot.fetch_channel(int(reviewer.discord_channel_id))
             except:
                raise HTTPException(status_code=404, detail="Discord channel not found")

        guild = channel.guild
        if not guild:
             raise HTTPException(status_code=400, detail="Channel is not in a guild")

        # Get the member (the reviewer user)
        # We need the user's discord_id
        user = reviewer.user
        if not user or not user.discord_id:
             raise HTTPException(status_code=400, detail="Reviewer has no Discord ID linked")

        member = guild.get_member(int(user.discord_id))
        if not member:
            try:
                member = await guild.fetch_member(int(user.discord_id))
            except:
                 raise HTTPException(status_code=404, detail="Reviewer not found in the Discord guild")

        # Get avatar
        avatar_url = str(member.display_avatar.url)

        # Update reviewer
        update_data = schemas.ReviewerSettingsUpdate(avatar_url=avatar_url)
        updated_reviewer = await queue_service.update_reviewer_settings(db, reviewer_id, update_data)
        return await media_service.enrich_reviewer_profile(updated_reviewer)

    except Exception as e:
        import logging
        logging.error(f"Error syncing avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync avatar: {str(e)}")

@router.get("/{reviewer_id}/discord/channels", response_model=List[schemas.DiscordChannel], dependencies=[Depends(check_is_reviewer)])
async def get_discord_channels(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetches available text and voice channels from the Discord guild.
    """
    from bot_instance import bot
    import discord
    
    if not bot or not bot.is_ready():
         raise HTTPException(status_code=503, detail="Discord bot is not ready")

    # We need to find the guild. 
    # Default to first guild for now as per ChannelCreatorCog
    guild = None
    if bot.guilds:
        guild = bot.guilds[0]
    
    if not guild:
        raise HTTPException(status_code=404, detail="Bot is not in any guild")

    channels = []
    for channel in guild.channels:
        if isinstance(channel, (discord.TextChannel, discord.VoiceChannel)):
             channels.append({
                 "id": str(channel.id),
                 "name": channel.name,
                 "type": "text" if isinstance(channel, discord.TextChannel) else "voice",
                 "category": channel.category.name if channel.category else None
             })
    
    return channels
