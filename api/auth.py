import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

import schemas
import security
from config import settings
from database import get_db
from services import user_service, queue_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/login")
async def login():
    """Redirects the user to Discord's OAuth2 authorization URL."""
    return RedirectResponse(
        f"https://discord.com/api/oauth2/authorize?client_id={settings.DISCORD_CLIENT_ID}"
        f"&redirect_uri={settings.DISCORD_REDIRECT_URI}&response_type=code&scope=identify"
    )

@router.get("/callback")
async def callback(code: str, db: Session = Depends(get_db)):
    """Handles the callback from Discord, creates/updates the user, and returns a JWT."""
    async with httpx.AsyncClient() as client:
        # Exchange the code for an access token
        token_response = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": settings.DISCORD_CLIENT_ID,
                "client_secret": settings.DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.DISCORD_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        # Fetch the user's profile from Discord
        user_response = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_response.raise_for_status()
        discord_user = user_response.json()

    # Create or update the user in the database
    avatar_hash = discord_user.get("avatar")
    avatar_url = f"https://cdn.discordapp.com/avatars/{discord_user['id']}/{avatar_hash}.png" if avatar_hash else None
    user = user_service.get_or_create_user(
        db, discord_id=discord_user["id"], username=discord_user["username"], avatar=avatar_url
    )

    # Determine the user's roles
    roles = ["user"]
    reviewer = queue_service.get_reviewer_by_user_id(db, user.id)
    if reviewer:
        roles.append("reviewer")
    # Check if the user is an admin by comparing string versions of the IDs
    if str(user.discord_id) in settings.ADMIN_DISCORD_IDS:
        roles.append("admin")

    # Create a JWT for the user
    jwt_token = security.create_access_token(data={"sub": user.discord_id, "roles": roles})

    # Redirect to the frontend with the token
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}")
