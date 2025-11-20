from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
import models
from datetime import datetime, timedelta, timezone


async def get_user_by_discord_id(db: AsyncSession, discord_id: str) -> models.User | None:
    """Retrieves a user by their Discord ID."""
    result = await db.execute(
        select(models.User)
        .options(joinedload(models.User.reviewer_profile))
        .filter(models.User.discord_id == discord_id)
    )
    user = result.scalars().first()
    if user:
        user.level = calculate_level(user.xp)
    return user

async def get_or_create_user(db: AsyncSession, discord_id: str, username: str, avatar: str | None = None) -> models.User:
    """
    Retrieves a user by their Discord ID, or creates a new one if they don't exist.
    """
    user = await get_user_by_discord_id(db, discord_id)
    if user:
        # Update username or avatar if changed
        changed = False
        if user.username != username:
            user.username = username
            changed = True
        if user.avatar != avatar:
            user.avatar = avatar
            changed = True
        
        if changed:
            await db.commit()
            await db.refresh(user)
        return user

    new_user = models.User(discord_id=discord_id, username=username, avatar=avatar)
    db.add(new_user)
    await db.commit()
    # Use get_user_by_discord_id to reload with relationships eager loaded
    return await get_user_by_discord_id(db, discord_id)

async def add_xp(db: AsyncSession, user_id: int, amount: int) -> models.User:
    """Adds XP to a user and calculates their new level."""
    result = await db.execute(select(models.User).filter(models.User.id == user_id))
    user = result.scalars().first()
    if user:
        user.xp += amount
        await db.commit()
        await db.refresh(user)
    return user

def calculate_level(xp: int) -> int:
    """Calculates level based on XP. Formula: Level = floor(sqrt(XP / 10))"""
    import math
    if xp < 0: return 0
    return math.floor(math.sqrt(xp / 10))

async def get_user_by_username(db: AsyncSession, username: str) -> models.User | None:
    """Retrieves a user by their username."""
    result = await db.execute(select(models.User).filter(models.User.username == username))
    return result.scalars().first()

async def get_user_by_tiktok_username(db: AsyncSession, tiktok_username: str) -> models.User | None:
    """Retrieve a user by their TikTok username."""
    result = await db.execute(select(models.User).filter(models.User.tiktok_username == tiktok_username))
    return result.scalars().first()

async def get_user_with_reviewer_profile(db: AsyncSession, discord_id: str) -> models.User | None:
    """Retrieves a user and their reviewer profile, if it exists."""
    result = await db.execute(select(models.User).filter(models.User.discord_id == discord_id))
    return result.scalars().first()

async def get_all_reviewers(db: AsyncSession) -> list[models.User]:
    """Retrieves all users who have a reviewer profile."""
    result = await db.execute(
        select(models.User)
        .join(models.Reviewer)
        .options(joinedload(models.User.reviewer_profile))
    )
    return result.scalars().all()

async def add_reviewer_profile(
        db: AsyncSession, user: models.User, tiktok_handle: str | None = None
) -> models.User:
    """Adds a reviewer profile to a user."""
    if user.reviewer_profile:
        # Update existing profile if tiktok_handle is provided
        if tiktok_handle:
            user.reviewer_profile.tiktok_handle = tiktok_handle
            await db.commit()
            # Re-fetch to ensure relationships are loaded
            return await get_user_by_discord_id(db, user.discord_id)
        return user

    # Create new profile
    new_reviewer_profile = models.Reviewer(
        user_id=user.id, tiktok_handle=tiktok_handle
    )
    db.add(new_reviewer_profile)
    await db.commit()

    # FIXED: Re-fetch the user to ensure the new reviewer_profile is loaded and ready for Pydantic
    return await get_user_by_discord_id(db, user.discord_id)

async def remove_reviewer_profile(db: AsyncSession, reviewer_id: int) -> bool:
    """Removes a reviewer profile from a user."""
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer_profile = result.scalars().first()
    if not reviewer_profile:
        return False

    await db.delete(reviewer_profile)
    await db.commit()
    return True

async def get_all_discord_users(db: AsyncSession) -> list[models.DiscordUserCache]:
    """Retrieves all users from the Discord user cache."""
    result = await db.execute(select(models.DiscordUserCache))
    return result.scalars().all()


async def update_user_spotify_tokens(
        db: AsyncSession,
        discord_id: str,
        access_token: str,
        refresh_token: str,
        expires_in: int,
) -> models.User:
    """Updates a user's Spotify tokens and expiration time."""
    user = await get_user_by_discord_id(db, discord_id)
    if not user:
        raise ValueError("User not found")

    user.spotify_access_token = access_token
    user.spotify_refresh_token = refresh_token
    user.spotify_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    await db.commit()
    await db.refresh(user)
    return user


def is_spotify_token_expired(user: models.User) -> bool:
    """Checks if the user's Spotify access token is expired or close to expiring."""
    if not user.spotify_token_expires_at:
        return True
    expiry = user.spotify_token_expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    # Check if the token expires in the next 60 seconds
    return expiry <= datetime.now(timezone.utc) + timedelta(seconds=60)
