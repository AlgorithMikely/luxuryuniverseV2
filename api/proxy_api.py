import httpx
import logging
from fastapi import APIRouter, Query, HTTPException
from starlette.responses import StreamingResponse

router = APIRouter(tags=["Proxy"])

# Define a standard User-Agent to avoid being blocked by services like Discord's CDN
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

async def _stream_generator(client: httpx.AsyncClient, url: str):
    """
    An async generator that streams content from the given URL. It includes
    robust error handling to prevent the backend from crashing on network errors.
    """
    try:
        async with client.stream("GET", url, headers=HEADERS, timeout=30.0) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes():
                yield chunk
    except httpx.HTTPStatusError as e:
        logging.error(f"Proxy stream failed with status {e.response.status_code} for URL: {url}")
        # Let the main function handle the exception to avoid unhandled errors in the generator.
    except httpx.RequestError as e:
        logging.error(f"Proxy stream failed for URL: {url}. Error: {e}")
        # Let the main function handle the exception.
    except Exception as e:
        logging.error(f"An unexpected error occurred during proxy stream for URL: {url}. Error: {e}", exc_info=True)
        # Let the main function handle the exception.


@router.get("/audio")
async def proxy_stream(url: str = Query(...)):
    """
    Proxies an audio stream from a given URL, forwarding essential headers
    like Content-Type and Content-Length to ensure the browser can decode the audio.
    """
    client = httpx.AsyncClient()
    try:
        # First, make a HEAD request to get the headers without downloading the body.
        head_response = await client.head(url, headers=HEADERS, timeout=10.0)
        head_response.raise_for_status()

        content_type = head_response.headers.get("Content-Type", "application/octet-stream")
        content_length = head_response.headers.get("Content-Length")

        headers = {
            "Content-Type": content_type,
            "Content-Disposition": "inline", # Important for playback in browser
        }
        if content_length:
            headers["Content-Length"] = content_length

        # Now, create the streaming response with the correct headers.
        return StreamingResponse(
            _stream_generator(client, url),
            status_code=200,
            headers=headers,
            background=client.aclose  # Ensure client is closed after stream completes
        )

    except httpx.HTTPStatusError as e:
        await client.aclose()
        raise HTTPException(status_code=e.response.status_code, detail="Upstream server returned an error.")
    except httpx.RequestError as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Could not connect to upstream server: {e}")
    except Exception as e:
        await client.aclose()
        logging.error(f"An unexpected error occurred during proxy HEAD request for URL: {url}. Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred.")
