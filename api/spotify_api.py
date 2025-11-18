from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx

from database import get_db
from models import User
from security import get_current_active_user
from services import user_service
from config import settings
import logging

router = APIRouter(prefix="/spotify", tags=["Spotify"])

# Scopes needed for the Web Playback SDK
SPOTIFY_SCOPES = "streaming user-read-email user-read-private"

@router.get("/login")
async def spotify_login(current_user: User = Depends(get_current_active_user)):
    """
    Redirects the user to Spotify's authorization page.
    """
    auth_url = (
        f"https://accounts.spotify.com/authorize"
        f"?response_type=code"
        f"&client_id={settings.SPOTIFY_CLIENT_ID}"
        f"&scope={SPOTIFY_SCOPES}"
        f"&redirect_uri={settings.SPOTIFY_REDIRECT_URI}"
        f"&state={current_user.discord_id}"  # Use discord_id to link accounts
    )
    return RedirectResponse(auth_url)

@router.get("/callback")
async def spotify_callback(code: str, state: str, db: Session = Depends(get_db)):
    """
    Handles the callback from Spotify, exchanges the code for tokens,
    and stores them for the user.
    """
    discord_id = state  # The user's discord_id was passed in the state

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
        user_service.update_user_spotify_tokens(
            db,
            discord_id=discord_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

    return RedirectResponse(f"{settings.FRONTEND_URL}/hub")

@router.get("/token")
async def get_spotify_token(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """
    Provides the frontend with a short-lived Spotify access token.
    If the current access token is expired, it uses the refresh token to get a new one.
    """
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
        current_user = user_service.update_user_spotify_tokens(
            db=db,
            discord_id=current_user.discord_id,
            access_token=token_data['access_token'],
            refresh_token=current_user.spotify_refresh_token, # Refresh token might be rotated, but often is not
            expires_in=token_data['expires_in']
        )

    return {"access_token": current_user.spotify_access_token}
