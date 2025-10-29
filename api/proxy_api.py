import httpx
from fastapi import APIRouter, Query
from starlette.responses import StreamingResponse

router = APIRouter(prefix="/proxy", tags=["Proxy"])

@router.get("/audio")
async def proxy_stream(url: str = Query(...)):
    async with httpx.AsyncClient() as client:
        req = client.build_request("GET", url)
        r = await client.send(req, stream=True)
        return StreamingResponse(r.aiter_bytes())
