from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter()

@router.get("/audio")
async def audio_proxy(url: str):
    async with httpx.AsyncClient() as client:
        try:
            req = client.build_request("GET", url)
            res = await client.send(req, stream=True)
            res.raise_for_status()
            return StreamingResponse(res.aiter_bytes(), headers=res.headers)
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch audio from the source.")
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Failed to connect to the audio source.")
