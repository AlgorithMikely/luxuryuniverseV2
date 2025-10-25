
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import schemas
import security
from database import get_db
from services import user_service

router = APIRouter(prefix="/admin", tags=["Admin"])

async def check_is_admin(
    current_user: schemas.TokenData = Depends(security.get_current_user)
):
    if "admin" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")
    return current_user

@router.get("/reviewers", dependencies=[Depends(check_is_admin)])
async def get_all_reviewers(db: Session = Depends(get_db)):
    return user_service.get_all_reviewers(db)
