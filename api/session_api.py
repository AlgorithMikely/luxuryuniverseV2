from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

import models
import schemas
from database import get_db
from security import get_current_user
from services import queue_service, user_service

router = APIRouter()

@router.post("", response_model=schemas.ReviewSession)
async def create_session(
        session_create: schemas.ReviewSessionCreate,
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

    target_reviewer_id = user.reviewer_profile.id if user.reviewer_profile else None

    if reviewer_id:
        if "admin" in token.roles:
            target_reviewer_id = reviewer_id
        elif target_reviewer_id != reviewer_id:
            raise HTTPException(status_code=403, detail="Not authorized to create session for this reviewer")
    
    if not target_reviewer_id:
         raise HTTPException(status_code=403, detail="User is not a reviewer and no reviewer_id provided")

    return await queue_service.create_session(db, target_reviewer_id, session_create.name, session_create.open_queue_tiers)



@router.get("", response_model=List[schemas.ReviewSession])
async def get_sessions(
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

    target_reviewer_id = user.reviewer_profile.id if user.reviewer_profile else None

    if reviewer_id:
        # If requesting a specific reviewer, check permissions
        if "admin" in token.roles:
            target_reviewer_id = reviewer_id
        elif target_reviewer_id != reviewer_id:
            raise HTTPException(status_code=403, detail="Not authorized to view this reviewer's sessions")
    
    if not target_reviewer_id:
         raise HTTPException(status_code=403, detail="User is not a reviewer and no reviewer_id provided")

    return await queue_service.get_sessions_by_reviewer(db, target_reviewer_id)

@router.get("/active", response_model=schemas.ReviewSession)
async def get_active_session(
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    target_reviewer_id = None

    if reviewer_id:
        # Public access: Anyone can view a reviewer's active session
        target_reviewer_id = reviewer_id
    else:
        # Default to current user's reviewer profile if no ID provided
        user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
        if user and user.reviewer_profile:
            target_reviewer_id = user.reviewer_profile.id

    if not target_reviewer_id:
         raise HTTPException(status_code=400, detail="Reviewer ID is required")

    session = await queue_service.get_active_session_by_reviewer(db, target_reviewer_id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    return session

@router.post("/{session_id}/activate", response_model=schemas.ReviewSession)
async def activate_session(
        session_id: int,
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

    target_reviewer_id = user.reviewer_profile.id if user.reviewer_profile else None

    if reviewer_id:
        if "admin" in token.roles:
            target_reviewer_id = reviewer_id
        elif target_reviewer_id != reviewer_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this reviewer's sessions")
            
    if not target_reviewer_id:
         raise HTTPException(status_code=403, detail="User is not a reviewer and no reviewer_id provided")

    return await queue_service.activate_session(db, target_reviewer_id, session_id)

@router.post("/{session_id}/archive", response_model=schemas.ReviewSession)
async def archive_session(
        session_id: int,
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

    target_reviewer_id = user.reviewer_profile.id if user.reviewer_profile else None

    if reviewer_id:
        if "admin" in token.roles:
            target_reviewer_id = reviewer_id
        elif target_reviewer_id != reviewer_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this reviewer's sessions")

    if not target_reviewer_id:
         raise HTTPException(status_code=403, detail="User is not a reviewer and no reviewer_id provided")

    return await queue_service.archive_session(db, target_reviewer_id, session_id)

@router.patch("/{session_id}", response_model=schemas.ReviewSession)
async def update_session(
        session_id: int,
        session_update: schemas.ReviewSessionUpdate,
        reviewer_id: int = None,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user:
        raise HTTPException(status_code=403, detail="User not found")

    target_reviewer_id = user.reviewer_profile.id if user.reviewer_profile else None

    if reviewer_id:
        if "admin" in token.roles:
            target_reviewer_id = reviewer_id
        elif target_reviewer_id != reviewer_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this reviewer's sessions")

    if not target_reviewer_id:
         raise HTTPException(status_code=403, detail="User is not a reviewer and no reviewer_id provided")

    return await queue_service.update_session(db, target_reviewer_id, session_id, session_update)

@router.get("/{session_id}", response_model=List[schemas.Submission])
async def get_session_submissions(
        session_id: int,
        db: AsyncSession = Depends(get_db),
        token: schemas.TokenData = Depends(get_current_user),
):
    user = await user_service.get_user_by_discord_id(db, discord_id=token.discord_id)
    if not user or not user.reviewer_profile:
        raise HTTPException(status_code=403, detail="User is not a reviewer")

    session = await queue_service.get_session_by_id(db, session_id)
    if not session or session.reviewer_id != user.reviewer_profile.id:
        raise HTTPException(status_code=404, detail="Session not found")

    return await queue_service.get_submissions_by_session(db, session_id)
