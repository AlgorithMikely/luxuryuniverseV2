from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from database import get_db
from models import User
from security import get_current_active_user
from services import user_service
from config import settings
import logging

router = APIRouter(prefix="/spotify", tags=["Spotify"])

# Scopes needed for the Web Playback SDK
SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state user-read-currently-playing"

@router.get("/login")
async def spotify_login(
    force_login: bool = False, 
    return_url: str = None,
    current_user: User = Depends(get_current_active_user)
):
    """
    Redirects the user to Spotify's authorization page.
    """
    from urllib.parse import urlencode
    
    # Encode return_url in state if provided
    state_value = current_user.discord_id
    if return_url:
        state_value = f"{current_user.discord_id}|{return_url}"

    params = {
        "response_type": "code",
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "scope": SPOTIFY_SCOPES,
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
        "state": state_value,
    }
    
    if force_login:
        params["show_dialog"] = "true"
        
    auth_url = f"https://accounts.spotify.com/authorize?{urlencode(params)}"
    return {"url": auth_url}

@router.get("/callback")
async def spotify_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """
    Handles the callback from Spotify, exchanges the code for tokens,
    and stores them for the user.
    """
    # Parse state to get discord_id and optional return_url
    parts = state.split('|', 1)
    discord_id = parts[0]
    return_url = parts[1] if len(parts) > 1 else None

    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
                "client_id": settings.SPOTIFY_CLIENT_ID,
                "client_secret": settings.SPOTIFY_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code != 200:
            logging.error(f"Error fetching Spotify token: {token_response.text}")
            raise HTTPException(status_code=400, detail="Error fetching Spotify token")

        token_data = token_response.json()
        access_token = token_data["access_token"]
        refresh_token = token_data["refresh_token"]
        expires_in = token_data["expires_in"]

        # Store tokens in the database
        logging.info(f"Updating Spotify tokens for discord_id: {discord_id}")
        try:
            user = await user_service.update_user_spotify_tokens(
                db,
                discord_id=discord_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=expires_in,
            )
            logging.info("Successfully updated Spotify tokens")
            
            if return_url:
                return RedirectResponse(return_url)
            
            if user.reviewer_profile:
                return RedirectResponse(f"{settings.FRONTEND_URL}/reviewer/{user.reviewer_profile.id}")
            
        except Exception as e:
            logging.error(f"Failed to update Spotify tokens: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save tokens: {str(e)}")

    return RedirectResponse(f"{settings.FRONTEND_URL}/hub")

@router.post("/disconnect")
async def spotify_disconnect(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Disconnects the user's Spotify account.
    """
    try:
        await user_service.update_user_spotify_tokens(
            db,
            discord_id=current_user.discord_id,
            access_token=None,
            refresh_token=None,
            expires_in=None
        )
        return {"status": "disconnected"}
    except Exception as e:
        logging.error(f"Failed to disconnect Spotify: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")


@router.get("/token")
async def get_spotify_token(current_user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    """
    Provides the frontend with a short-lived Spotify access token.
    If the current access token is expired, it uses the refresh token to get a new one.
    """
    try:
        if not current_user.spotify_refresh_token:
            raise HTTPException(status_code=404, detail="User not connected to Spotify")

        # Check if the token is expired or close to expiring
        if user_service.is_spotify_token_expired(current_user):
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://accounts.spotify.com/api/token",
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": current_user.spotify_refresh_token,
                        "client_id": settings.SPOTIFY_CLIENT_ID,
                        "client_secret": settings.SPOTIFY_CLIENT_SECRET,
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

            if response.status_code != 200:
                logging.error(f"Error refreshing Spotify token: {response.text}")
                # If refresh fails, the user might need to re-authenticate
                raise HTTPException(status_code=400, detail="Could not refresh Spotify token")

            token_data = response.json()

            # Update the database with the new token info
            current_user = await user_service.update_user_spotify_tokens(
                db=db,
                discord_id=current_user.discord_id,
                access_token=token_data['access_token'],
                refresh_token=current_user.spotify_refresh_token, # Refresh token might be rotated, but often is not
                expires_in=token_data['expires_in']
            )

        return {"access_token": current_user.spotify_access_token}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Unexpected error in get_spotify_token: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

from pydantic import BaseModel
from typing import List, Optional

class PlayRequest(BaseModel):
    device_id: str
    uris: List[str]
    position_ms: Optional[int] = 0

@router.put("/play")
async def spotify_play(
    play_request: PlayRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Starts playback on the specified device.
    """
    # Ensure we have a valid token (refresh if needed)
    await get_spotify_token(current_user, db)
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"https://api.spotify.com/v1/me/player/play?device_id={play_request.device_id}",
            json={"uris": play_request.uris, "position_ms": play_request.position_ms},
            headers={
                "Authorization": f"Bearer {current_user.spotify_access_token}",
                "Content-Type": "application/json"
            },
        )
        
        if response.status_code not in (200, 204):
            logging.error(f"Error starting playback: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Failed to start playback: {response.text}")
            
    return {"status": "success"}

@router.get("/track/{track_id}")
async def get_spotify_track(
    track_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches track metadata from Spotify.
    """
    # Ensure we have a valid token
    await get_spotify_token(current_user, db)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers={
                "Authorization": f"Bearer {current_user.spotify_access_token}",
            },
        )

        if response.status_code != 200:
            logging.error(f"Error fetching track info: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch track info")

        return response.json()

class ProxyTrackRequest(BaseModel):
    url: str

@router.post("/proxy/track")
async def proxy_spotify_track(
    request: ProxyTrackRequest
):
    """
    Fetches track metadata using the server's Client Credentials.
    Does not require a user context.
    """
    # Use Client Credentials Flow to get a token
    async with httpx.AsyncClient() as client:
        auth_response = await client.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.SPOTIFY_CLIENT_ID,
                "client_secret": settings.SPOTIFY_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if auth_response.status_code != 200:
            logging.error(f"Error getting client credentials token: {auth_response.text}")
            raise HTTPException(status_code=500, detail="Failed to authenticate with Spotify")

        token = auth_response.json()["access_token"]

        # Parse track ID from URL
        # URL format: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT...
        import re
        match = re.search(r"track/([a-zA-Z0-9]+)", request.url)
        if not match:
             raise HTTPException(status_code=400, detail="Invalid Spotify track URL")

        track_id = match.group(1)

        # Fetch track info
        response = await client.get(
            f"https://api.spotify.com/v1/tracks/{track_id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        if response.status_code != 200:
            logging.error(f"Error fetching track info (proxy): {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch track info")

        return response.json()
