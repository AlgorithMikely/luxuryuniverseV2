from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter(prefix="/proxy", tags=["Proxy"])

@router.get("/audio")
async def audio_proxy(request: Request):
    url = request.query_params.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")

    async with httpx.AsyncClient() as client:
        try:
            req = client.build_request("GET", url, headers={"User-Agent": "Mozilla/5.0"})
            r = await client.send(req, stream=True)
            r.raise_for_status()

            # selectively forward headers
            response_headers = {
                'Content-Type': r.headers.get('Content-Type'),
                'Content-Length': r.headers.get('Content-Length'),
            }

            return StreamingResponse(r.aiter_bytes(), headers=response_headers)

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch audio: {e}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Request failed: {e}")
