import io
import logging
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/proxy", tags=["Proxy"])

@router.get("/audio")
async def audio_proxy(request: Request):
    """
    Proxies audio files, downloading them entirely before serving.
    This makes the stream resilient to source connection drops and handles
    range requests for audio seeking.
    """
    url = request.query_params.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")

    headers_to_forward = {"User-Agent": "Mozilla/5.0"}

    async with httpx.AsyncClient() as client:
        try:
            # Download the entire file first to avoid streaming issues from the source
            r = await client.get(url, headers=headers_to_forward, follow_redirects=True)
            r.raise_for_status()
            audio_data = r.content
            file_size = len(audio_data)

            response_headers = {
                "Content-Type": r.headers.get("Content-Type", "application/octet-stream"),
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "max-age=3600",  # Cache on client for 1 hour
            }

            content_to_send = io.BytesIO(audio_data)
            status_code = 200

            # Handle Range requests for seeking
            range_header = request.headers.get("range")
            if range_header:
                try:
                    range_value = range_header.strip().split("=")[1]
                    start_str, end_str = range_value.split("-")
                    start = int(start_str)
                    end = int(end_str) if end_str else file_size - 1

                    if start >= file_size or start < 0:
                        raise HTTPException(status_code=416, detail="Requested range not satisfiable")

                    end = min(end, file_size - 1)
                    length = end - start + 1

                    # Update status code and headers for partial content
                    status_code = 206
                    response_headers["Content-Length"] = str(length)
                    response_headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

                    # Serve only the requested slice of data
                    content_to_send = io.BytesIO(audio_data[start:end+1])
                    logging.info(f"Serving range: {start}-{end} of {file_size} bytes")

                except (ValueError, IndexError):
                    logging.warning(f"Invalid Range header: '{range_header}'. Serving full file.")
                    # If range header is malformed, ignore it and send the full file.
                    pass

            media_type = response_headers.pop("Content-Type")
            return StreamingResponse(
                content_to_send,
                status_code=status_code,
                headers=response_headers,
                media_type=media_type
            )

        except httpx.HTTPStatusError as e:
            # Re-raise error with the status code from the remote server
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch audio: {e}")
        except httpx.RequestError as e:
            # Handle network errors when trying to contact the remote server
            raise HTTPException(status_code=502, detail=f"Bad Gateway: Could not contact audio source: {e}")
