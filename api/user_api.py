from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
import schemas
import security
from database import get_db
from services import economy_service, user_service, queue_service

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/me", response_model=schemas.UserProfile)
async def get_me(
    db_user: models.User = Depends(security.get_current_active_user),
    token: schemas.TokenData = Depends(security.get_current_user),
):
    # Manually construct the UserProfile to include roles from the token
    user_profile = schemas.UserProfile(
        id=db_user.id,
        discord_id=db_user.discord_id,
        username=db_user.username,
        reviewer_profile=db_user.reviewer_profile,
        roles=token.roles,
        moderated_reviewers=user_service.get_all_reviewers(get_db().__next__()) if "admin" in token.roles else [],
    )
    return user_profile

@router.get("/me/balance")
async def get_my_balance(
    reviewer_id: int = Query(...),
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db),
):
    balance = economy_service.get_balance(db, reviewer_id=reviewer_id, user_id=current_user.id)
    return {"balance": balance}

@router.get("/me/submissions")
async def get_my_submissions(
    current_user: models.User = Depends(security.get_current_active_user),
    db: Session = Depends(get_db),
):
    return queue_service.get_submissions_by_user(db, user_id=current_user.id)
