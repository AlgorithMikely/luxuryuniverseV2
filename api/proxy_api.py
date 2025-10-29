import httpx
import logging
from fastapi import APIRouter, Query, HTTPException
from starlette.responses import StreamingResponse

router = APIRouter(prefix="/proxy", tags=["Proxy"])

# Define a standard User-Agent to avoid being blocked by services like Discord's CDN
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

async def _stream_generator(url: str):
    """
    An async generator that streams content from the given URL. It includes
    robust error handling to prevent the backend from crashing on network errors.
    """
    async with httpx.AsyncClient() as client:
        try:
            # Use a context-managed stream to ensure resources are properly managed
            async with client.stream("GET", url, headers=HEADERS, timeout=30.0) as response:
                # Immediately raise an exception for bad status codes (e.g., 404, 500)
                response.raise_for_status()
                # Yield chunks of the response as they are received
                async for chunk in response.aiter_bytes():
                    yield chunk
        except httpx.HTTPStatusError as e:
            # This error occurs if the upstream server returns a 4xx or 5xx response.
            logging.error(f"Proxy stream failed with status {e.response.status_code} for URL: {url}")
            # If the stream hasn't started, FastAPI can handle this and return a proper error.
            raise HTTPException(status_code=e.response.status_code, detail="Upstream server returned an error.")
        except httpx.RequestError as e:
            # This handles network-level errors, like connection refused, timeouts, or DNS issues.
            logging.error(f"Proxy stream failed for URL: {url}. Error: {e}")
            raise HTTPException(status_code=502, detail=f"Could not connect to upstream server: {e}")
        except Exception as e:
            # A general catch-all for any other unexpected errors during the stream.
            logging.error(f"An unexpected error occurred during proxy stream for URL: {url}. Error: {e}", exc_info=True)
            # The client connection will likely be dropped here, but logging the error is crucial.


@router.get("/audio")
async def proxy_stream(url: str = Query(...)):
    """
    Proxies an audio stream from a given URL.
    This is used to bypass CORS issues in the frontend.
    """
    return StreamingResponse(_stream_generator(url))
