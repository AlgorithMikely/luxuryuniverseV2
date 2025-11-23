from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from database import get_db
import models
import schemas
from security import get_current_user
# Fix: Import TokenData from schemas, not security
from schemas import TokenData

router = APIRouter(prefix="/achievements", tags=["Achievements"])

@router.get("/", response_model=List[dict])
async def get_achievements(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return []
