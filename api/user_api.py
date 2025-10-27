from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

import schemas
import security
from database import get_db
from services import economy_service, user_service, queue_service

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/me", response_model=schemas.UserProfile)
async def get_me(
    current_user: schemas.TokenData = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_with_reviewer_profile(db, current_user.discord_id)
    return user

@router.get("/me/balance")
async def get_my_balance(
    reviewer_id: int = Query(None),
    current_user: schemas.TokenData = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_by_discord_id(db, current_user.discord_id)
    if reviewer_id:
        balance = economy_service.get_balance(db, reviewer_id=reviewer_id, user_id=user.id)
    else:
        balance = economy_service.get_total_balance(db, user_id=user.id)
    return {"balance": balance}

@router.get("/me/submissions", response_model=List[schemas.SubmissionDetail])
async def get_my_submissions(
    current_user: schemas.TokenData = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    user = user_service.get_user_by_discord_id(db, current_user.discord_id)
    return queue_service.get_submissions_by_user(db, user_id=user.id)
