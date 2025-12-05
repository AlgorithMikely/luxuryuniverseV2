from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from database import get_db
import models
import security

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(security.get_current_active_user)
):
    result = await db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(security.get_current_active_user)
):
    result = await db.execute(
        select(models.Notification)
        .where(models.Notification.id == notification_id, models.Notification.user_id == user.id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    await db.commit()
    return {"status": "success"}

@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(security.get_current_active_user)
):
    await db.execute(
        update(models.Notification)
        .where(models.Notification.user_id == user.id, models.Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "success"}
