from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from database import get_db
import models

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/")
async def search(
    q: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Global search endpoint.
    Searches:
    - Users by username
    - Reviewers by username or tiktok_handle
    - Tracks by title or artist
    """
    if not q or len(q) < 2:
        return {"users": [], "reviewers": [], "tracks": []}
        
    term = f"%{q}%"
    
    # Search Users
    users_res = await db.execute(
        select(models.User).where(models.User.username.ilike(term)).limit(5)
    )
    
    # Search Reviewers (join User for username)
    reviewers_res = await db.execute(
        select(models.Reviewer).join(models.User).where(
            or_(
                models.User.username.ilike(term),
                models.Reviewer.tiktok_handle.ilike(term)
            )
        ).limit(5)
    )
    
    # Search Tracks
    tracks_res = await db.execute(
        select(models.Submission).where(
            or_(
                models.Submission.track_title.ilike(term),
                models.Submission.artist.ilike(term)
            )
        ).limit(5)
    )
    
    return {
        "users": users_res.scalars().all(),
        "reviewers": reviewers_res.scalars().all(),
        "tracks": tracks_res.scalars().all()
    }
