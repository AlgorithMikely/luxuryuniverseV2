from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
import httpx
import logging

router = APIRouter(prefix="/proxy", tags=["Proxy"])

@router.get("/audio")
async def audio_proxy(request: Request, response: Response):
    url = request.query_params.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")

    range_header = request.headers.get("range")

    # Prepare headers to forward to the remote server
    headers_to_forward = {"User-Agent": "Mozilla/5.0"}
    if range_header:
        headers_to_forward["Range"] = range_header
        logging.info(f"Forwarding range header: {range_header}")

    async with httpx.AsyncClient() as client:
        try:
            req = client.build_request("GET", url, headers=headers_to_forward)
            r = await client.send(req, stream=True)
            r.raise_for_status()

            # Prepare response headers, forwarding range-specific ones if they exist
            response_headers = {
                "Content-Type": r.headers.get("Content-Type"),
                "Accept-Ranges": r.headers.get("Accept-Ranges", "bytes"),
                "Content-Range": r.headers.get("Content-Range"),
            }
            # Filter out None values and Content-Length to force chunked encoding
            response_headers = {k: v for k, v in response_headers.items() if v is not None and k.lower() != 'content-length'}

            # FastAPI's StreamingResponse takes the status_code as an argument
            # The status code from the remote server (e.g., 200 or 206) is crucial.

            async def stream_generator():
                try:
                    async for chunk in r.aiter_bytes():
                        yield chunk
                except httpx.ReadError as e:
                    logging.warning(f"Audio stream read error: {e}")
                finally:
                    await r.aclose()

            return StreamingResponse(
                stream_generator(),
                status_code=r.status_code,
                headers=response_headers
            )

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch audio: {e}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}")
