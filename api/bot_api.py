from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from database import get_db
import services.queue_service as queue_service
import schemas
from config import settings

router = APIRouter(
    prefix="/api/submissions",
    tags=["bot"],
)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    if api_key_header == settings.BOT_API_KEY:
        return api_key_header
    else:
        raise HTTPException(status_code=403, detail="Could not validate credentials")

@router.post("/bot")
async def create_bot_submission(submission_data: schemas.BotSubmissionCreate, db: Session = Depends(get_db), api_key: str = Depends(get_api_key)):
    """
    Endpoint for the Discord bot to create a new submission.
    """
    reviewer = queue_service.get_reviewer_by_channel_id(db, submission_data.discord_channel_id)
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found for the given channel ID")

    new_submission = await queue_service.create_submission(
        db,
        reviewer_id=reviewer.id,
        user_id=submission_data.user_id,
        track_url=submission_data.track_url,
        track_title=submission_data.track_title,
        archived_url=submission_data.archived_url
    )

    return {"message": "Submission created successfully", "submission_id": new_submission.id}
