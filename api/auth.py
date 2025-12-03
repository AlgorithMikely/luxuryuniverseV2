import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

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
        f"&redirect_uri={settings.DISCORD_REDIRECT_URI}&response_type=code&scope=identify%20email"
    )

@router.get("/callback")
async def callback(code: str, db: AsyncSession = Depends(get_db)):
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
        user_response.raise_for_status()
        discord_user = user_response.json()

    # Create or update the user in the database
    try:
        user = await user_service.get_or_create_user(
            db, 
            discord_id=discord_user["id"], 
            username=discord_user["username"],
            email=discord_user.get("email"),
            avatar=discord_user.get("avatar") # Store the hash, not the URL
        )
    except ValueError as e:
        # Handle the case where email is already in use by another account
        raise HTTPException(status_code=400, detail=str(e))

    # Determine the user's roles
    roles = ["user"]
    reviewer_ids = []
    if user.reviewer_profile:
        roles.append("reviewer")
        reviewer_ids.append(user.reviewer_profile.id)
    
    # Check if the user is an admin
    if user.discord_id in settings.ADMIN_DISCORD_IDS:
        if "admin" not in roles:
            roles.append("admin")
        # Admins implicitly have access to all reviewers, but we might not list them all here
        # unless needed by the frontend. For now, let's keep it simple.

    # Create a JWT for the user
    jwt_token = security.create_access_token(
        data={
            "sub": user.discord_id, 
            "username": user.username, 
            "roles": roles,
            "reviewer_ids": reviewer_ids
        }
    )

    # Redirect to the frontend with the token
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}")
