from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from database import get_db
from models import Submission, User, Reviewer

router = APIRouter(
    prefix="/spotlight",
    tags=["spotlight"]
)

@router.get("")
async def get_spotlight(db: AsyncSession = Depends(get_db)):
    """
    Get spotlighted submissions.
    """
    # Query for submissions that are explicitly spotlighted
    # We join with User to get submitter details
    # We join with Reviewer to get reviewer details
    query = (
        select(Submission, User, Reviewer)
        .join(User, Submission.user_id == User.id)
        .join(Reviewer, Submission.reviewer_id == Reviewer.id)
        .where(Submission.spotlighted == True)
        .order_by(desc(Submission.submitted_at))
        .limit(50)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    spotlight_items = []
    for submission, user, reviewer in rows:
        # Get reviewer username via relationship or direct query if needed, 
        # but since we joined Reviewer, we can access reviewer.user if eager loaded or we need another join.
        # Actually Reviewer model has a 'user' relationship. 
        # To avoid N+1, we should probably join Reviewer's User too, or just use the reviewer's ID/handle for now.
        # Let's try to get the reviewer's username. The Reviewer model has a property `username` but that requires the user relationship to be loaded.
        # Let's do a join to get the reviewer's user object as well.
        pass

    # Refined query with 4-way join to get reviewer username efficiently
    query = (
        select(Submission, User, Reviewer, User.username.label("reviewer_username"))
        .join(User, Submission.user_id == User.id)
        .join(Reviewer, Submission.reviewer_id == Reviewer.id)
        .join(User, Reviewer.user_id == User.id, isouter=True) # Join User again for Reviewer? No, SQLAlchemy might get confused with two User joins.
        # Let's keep it simple first. We can use reviewer.tiktok_handle or just fetch the user.
    )
    
    # Simpler approach: Just join Submission -> User (Submitter) and Submission -> Reviewer.
    # We can fetch reviewer username in a separate step or just use tiktok_handle if available.
    # Or better: alias the User table.
    
    from sqlalchemy.orm import aliased
    Submitter = aliased(User)
    ReviewerUser = aliased(User)
    
    query = (
        select(Submission, Submitter, Reviewer, ReviewerUser)
        .join(Submitter, Submission.user_id == Submitter.id)
        .join(Reviewer, Submission.reviewer_id == Reviewer.id)
        .join(ReviewerUser, Reviewer.user_id == ReviewerUser.id)
        .where(Submission.spotlighted == True)
        .order_by(desc(Submission.submitted_at))
        .limit(50)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    spotlight_items = []
    for submission, submitter, reviewer, reviewer_user in rows:
        spotlight_items.append({
            "id": submission.id,
            "track_title": submission.track_title,
            "artist": submission.artist,
            "genre": submission.genre,
            "review_score": float(submission.review_score) if submission.review_score else None,
            "submitter_username": submitter.username,
            "submitter_avatar": submitter.avatar,
            "submitter_discord_id": submitter.discord_id,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "reviewer_name": reviewer.tiktok_handle if reviewer.tiktok_handle else reviewer_user.username,
            "reviewer_id": reviewer.id
        })
        
    return spotlight_items
