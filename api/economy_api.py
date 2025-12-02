from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
import models
import schemas
import security
from database import get_db
from services import economy_service, queue_service

router = APIRouter(prefix="/economy", tags=["Economy"])

@router.get("/transactions", response_model=List[schemas.Transaction])
async def get_transactions(
    reviewer_id: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get transaction logs.
    If reviewer_id is provided, checks if user is authorized to view that reviewer's logs.
    """
    
    # Authorization logic
    if "admin" in current_user.roles:
        pass # Admins can see everything
    elif "reviewer" in current_user.roles:
        # Reviewers can only see their own transactions
        reviewer = await queue_service.get_reviewer_by_user_id(db, current_user.id)
        if not reviewer:
             raise HTTPException(status_code=403, detail="Not a reviewer")
        
        if reviewer_id and reviewer_id != reviewer.id:
             raise HTTPException(status_code=403, detail="Cannot view other reviewer's transactions")
        
        reviewer_id = reviewer.id # Enforce reviewer_id
    else:
        raise HTTPException(status_code=403, detail="Not authorized to view transactions")

    stmt = select(models.Transaction).options(selectinload(models.Transaction.user))
    
    if reviewer_id:
        stmt = stmt.filter(models.Transaction.reviewer_id == reviewer_id)
        
    stmt = stmt.order_by(desc(models.Transaction.timestamp))
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/balance", response_model=int)
async def get_balance(
    reviewer_id: int,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's balance for a specific reviewer.
    """
    return await economy_service.get_balance(db, reviewer_id, current_user.id)
