from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

import models
import schemas
import security
from database import get_db
from services import economy_service, user_service, queue_service

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/me", response_model=schemas.UserProfile)
async def get_me(current_user: models.User = Depends(security.get_current_active_user)):
    return current_user

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
