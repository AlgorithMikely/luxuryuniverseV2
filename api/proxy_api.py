import io
import logging
import re
import httpx
import yt_dlp
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
import models
from security import get_current_user
import schemas
from bot_instance import bot

router = APIRouter(prefix="/stream", tags=["Stream"])

async def resolve_discord_url(jump_url: str) -> str:
    """
    Resolves a Discord message jump_url to a direct attachment URL.
    """
    match = re.match(r"https://discord.com/channels/(\d+)/(\d+)/(\d+)", jump_url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Discord jump_url format")

    _, channel_id, message_id = match.groups()

    try:
        channel = bot.get_channel(int(channel_id))
        if not channel:
            raise HTTPException(status_code=404, detail=f"Discord channel not found: {channel_id}")

        message = await channel.fetch_message(int(message_id))
        if not message.attachments:
            # If there's no attachment, it's likely a URL submission, so return the message content.
            return message.content

        return message.attachments[0].url
    except Exception as e:
        logging.error(f"Failed to resolve Discord URL ({jump_url}): {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve Discord URL: {e}")


@router.get("/{submission_id}")
async def stream_submission(submission_id: int, request: Request, db: Session = Depends(get_db), current_user: schemas.UserProfile = Depends(get_current_user)):
    """
    Provides a streaming proxy for a submission's audio.
    """
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Authorization Check: Ensure the user has access to this submission.
    # An admin can access any submission. A reviewer can access submissions for their own sessions.
    is_admin = "admin" in current_user.roles
    is_reviewer = current_user.reviewer_profile and submission.reviewer_id == current_user.reviewer_profile.id

    if not is_admin and not is_reviewer:
        raise HTTPException(status_code=403, detail="Not authorized to access this submission")

    url = submission.track_url
    if "discord.com/channels" in url:
        try:
            url = await resolve_discord_url(url)
        except HTTPException as e:
            raise e

    if "discord.com" not in url:
        try:
            with yt_dlp.YoutubeDL({'format': 'bestaudio', 'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                url = info['url']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to extract audio from URL: {e}")

    headers_to_forward = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, headers=headers_to_forward, follow_redirects=True)
            r.raise_for_status()
            audio_data = r.content
            file_size = len(audio_data)

            response_headers = {
                "Content-Type": r.headers.get("Content-Type", "application/octet-stream"),
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "max-age=3600",
            }

            content_to_send = io.BytesIO(audio_data)
            status_code = 200

            range_header = request.headers.get("range")
            if range_header:
                try:
                    range_value = range_header.strip().split("=")[1]
                    start_str, end_str = range_value.split("-")
                    start = int(start_str)
                    end = int(end_str) if end_str else file_size - 1
                    end = min(end, file_size - 1)
                    length = end - start + 1

                    status_code = 206
                    response_headers["Content-Length"] = str(length)
                    response_headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                    content_to_send = io.BytesIO(audio_data[start:end+1])

                except (ValueError, IndexError):
                    pass

            media_type = response_headers.pop("Content-Type")
            return StreamingResponse(
                content_to_send,
                status_code=status_code,
                headers=response_headers,
                media_type=media_type,
            )

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch audio: {e}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Bad Gateway: {e}")
