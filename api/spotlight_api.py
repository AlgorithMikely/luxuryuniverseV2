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
    # We also join with Reviewer's User to get reviewer username
    
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
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    # Aggregation Logic
    spotlight_map = {}
    
    # Helper to normalize URLs
    def normalize_url(url):
        if not url:
            return ""
        try:
            # Strip query parameters for Spotify and YouTube
            if "spotify.com" in url or "youtube.com" in url or "youtu.be" in url:
                return url.split('?')[0]
        except:
            pass
        return url

    for submission, submitter, reviewer, reviewer_user in rows:
        # Strategy:
        # 1. Use file_hash if available (exact file match)
        # 2. Use normalized URL if available (exact link match)
        # 3. Fallback to (Submitter, Title) to catch re-submissions of the same song by the same user
        #    (This handles cases where Artist is missing in one version, or file changed slightly)
        
        key = None
        
        if submission.file_hash:
            key = f"hash:{submission.file_hash}"
        elif submission.track_url:
            norm_url = normalize_url(submission.track_url)
            if norm_url.startswith("/api/uploads"):
                 key = f"url:{submission.track_url}"
            else:
                 key = f"url:{norm_url}"
        
        # Fallback: Group by User + Title
        # The user specifically requested: "when somebody re-submits the same submission that it doesn't duplicate"
        # This implies same submitter, same title.
        
        clean_title = submission.track_title.strip().lower() if submission.track_title else ""
        
        # If we have a title, check if we already have a group for this User+Title
        # We can't just generate a key, we need to check if an existing key in the map matches this User+Title.
        # But for simplicity, let's just make the key based on User+Title if we haven't matched Hash/URL.
        # Wait, if we use User+Title as the key, it will split if Hash/URL was used for the first one.
        # Ideally we want to merge into the SAME group.
        
        # Actually, let's make (Submitter, Title) the PRIMARY key if available.
        # If I upload File A (Hash A) "My Song", and File B (Hash B) "My Song".
        # They have different hashes.
        # If I group by Hash, they are separate.
        # If I group by (User, Title), they are merged.
        # The user WANTS them merged.
        
        if clean_title:
             key = f"user:{submitter.id}|title:{clean_title}"
        elif not key:
             key = f"id:{submission.id}"

        if key not in spotlight_map:
            spotlight_map[key] = {
                "id": submission.id, # Use the most recent submission ID as representative
                "track_title": submission.track_title,
                "artist": submission.artist,
                "genre": submission.genre,
                "review_score": float(submission.review_score) if submission.review_score else None,
                "submitter_username": submitter.username,
                "submitter_avatar": submitter.avatar,
                "submitter_discord_id": submitter.discord_id,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "reviewers": []
            }
            
        # Add reviewer if not already present
        reviewer_name = reviewer.tiktok_handle if reviewer.tiktok_handle else reviewer_user.username
        
        # Check if this reviewer is already in the list for this song
        if not any(r["id"] == reviewer.id for r in spotlight_map[key]["reviewers"]):
            spotlight_map[key]["reviewers"].append({
                "id": reviewer.id,
                "name": reviewer_name
            })
            
    # Convert map to list
    spotlight_items = list(spotlight_map.values())
        
    return spotlight_items
