from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import soundcloud_service

router = APIRouter(prefix="/soundcloud", tags=["SoundCloud"])

class TrackUrlRequest(BaseModel):
    url: str

@router.post("/metadata")
async def get_soundcloud_metadata(request: TrackUrlRequest):
    """
    Fetches metadata for a SoundCloud track.
    """
    if "soundcloud.com" not in request.url:
        raise HTTPException(status_code=400, detail="Invalid SoundCloud URL")

    try:
        metadata = await soundcloud_service.get_track_metadata(request.url)
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metadata: {str(e)}")
