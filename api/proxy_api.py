import io
import logging
import re
import httpx
import yt_dlp
import asyncio
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import bot_instance

router = APIRouter(prefix="/proxy", tags=["Proxy"])

async def resolve_discord_url(jump_url: str) -> str:
    """
    Resolves a Discord message jump_url to a direct attachment URL.
    """
    try:
        logging.info("Waiting for bot to be ready...")
        await asyncio.wait_for(bot_instance.bot_ready.wait(), timeout=10.0)
        logging.info("Bot is ready.")
    except asyncio.TimeoutError:
        logging.error("Timed out waiting for bot to become ready.")
        raise HTTPException(status_code=503, detail="Service Unavailable: Bot is not ready.")

    if not bot_instance.bot:
        raise HTTPException(status_code=503, detail="Service Unavailable: Bot is not initialized.")

    match = re.match(r"https://discord.com/channels/(\d+)/(\d+)/(\d+)", jump_url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Discord jump_url format")

    _, channel_id, message_id = match.groups()

    try:
        # Try to get from cache first
        channel = bot_instance.bot.get_channel(int(channel_id))
        if not channel:
            # If not in cache, try to fetch from API
            try:
                channel = await bot_instance.bot.fetch_channel(int(channel_id))
            except Exception as e:
                logging.error(f"Failed to fetch channel {channel_id}: {e}")
                channel = None

        if not channel:
            logging.error(f"Channel {channel_id} not found in cache or API.")
            raise HTTPException(
                status_code=404, 
                detail=f"Discord channel {channel_id} not found. Ensure the bot is in the server and has 'View Channel' permissions."
            )

        message = await channel.fetch_message(int(message_id))
        if not message.attachments:
            # If there's no attachment, it's likely a URL submission, so return the message content.
            return message.content

        return message.attachments[0].url
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to resolve Discord URL ({jump_url}): {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve Discord URL: {e}")


@router.get("/audio")
async def audio_proxy(request: Request):
    url = request.query_params.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")

    # If it's a Discord jump URL, resolve it first
    if "discord.com/channels" in url:
        try:
            url = await resolve_discord_url(url)
        except HTTPException as e:
            raise e

    # For non-Discord URLs, use yt-dlp to get a direct streamable URL
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
