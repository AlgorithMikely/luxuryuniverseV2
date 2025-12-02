from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
import models
from datetime import datetime, timedelta, timezone


async def get_user_by_discord_id(db: AsyncSession, discord_id: str) -> models.User | None:
    """Retrieves a user by their Discord ID."""
    result = await db.execute(
        select(models.User)
        .options(
            joinedload(models.User.reviewer_profile).options(
                selectinload(models.Reviewer.payment_configs),
                selectinload(models.Reviewer.economy_configs)
            ),
            selectinload(models.User.achievements).joinedload(models.UserAchievement.achievement)
        )
        .filter(models.User.discord_id == discord_id)
    )
    user = result.scalars().first()
    if user:
        user.level = calculate_level(user.xp)
        # Transform UserAchievements to flat list for schema if needed,
        # but Schema expects List[Achievement], so we might need to do mapping here or in API.
        # The schema definition `achievements: List[Achievement]` matches `Achievement` model which maps fields.
        # However, `user.achievements` is a list of `UserAchievement` objects, which have `.achievement` nested.
        # We should map this in the API layer or add a property to User model.
        # For now, let's keep the query efficient.
    return user

async def get_user_by_email(db: AsyncSession, email: str) -> models.User | None:
    """Retrieves a user by their email."""
    result = await db.execute(
        select(models.User)
        .options(
            joinedload(models.User.reviewer_profile).options(
                selectinload(models.Reviewer.payment_configs),
                selectinload(models.Reviewer.economy_configs)
            )
        )
        .filter(models.User.email == email)
    )
    user = result.scalars().first()
    if user:
        user.level = calculate_level(user.xp)
    return user

async def get_or_create_user(
    db: AsyncSession, 
    discord_id: str, 
    username: str, 
    email: str | None = None, 
    avatar: str | None = None
) -> models.User:
    """
    Retrieves a user by their Discord ID, or creates a new one.
    Handles merging if a guest user with the same email exists.
    """
    # 1. Try to find by Discord ID
    user = await get_user_by_discord_id(db, discord_id)
    
    if user:
        # User exists with this Discord ID. Update details.
        changed = False
        if user.username != username:
            user.username = username
            changed = True
        if user.avatar != avatar:
            user.avatar = avatar
            changed = True
        # If we have an email from Discord and the user has no email, save it.
        if email and not user.email:
            user.email = email
            changed = True
        
        if changed:
            await db.commit()
            await db.refresh(user)
        return user

    # 2. User not found by Discord ID. Check by Email (if provided).
    if email:
        existing_user_by_email = await get_user_by_email(db, email)
        if existing_user_by_email:
            # User exists with this email.
            if existing_user_by_email.is_guest:
                # Case B: User Found AND is_guest (The Guest). MERGE.
                existing_user_by_email.discord_id = discord_id
                existing_user_by_email.username = username
                existing_user_by_email.avatar = avatar
                existing_user_by_email.is_guest = False
                existing_user_by_email.is_verified = True # Verified via Discord
                
                await db.commit()
                await db.refresh(existing_user_by_email)
                return existing_user_by_email
            else:
                # Case D: User Found BUT discord_id is different (implied, since we didn't find by discord_id above).
                # Reject Login OR Merge. Spec recommends Reject.
                # For now, we will raise an error or just return the existing user but NOT update discord_id?
                # If we return it, the auth flow might try to use it.
                # Let's raise a ValueError that the auth handler can catch.
                raise ValueError(f"Email {email} is already in use by another account.")

    # 3. Case A: No User Found. Create new.
    new_user = models.User(
        discord_id=discord_id, 
        username=username, 
        email=email,
        avatar=avatar,
        is_guest=False,
        is_verified=True # Verified via Discord
    )
    db.add(new_user)
    await db.commit()
    # Use get_user_by_discord_id to reload with relationships eager loaded
    return await get_user_by_discord_id(db, discord_id)

async def get_or_create_guest_user(db: AsyncSession, email: str, tiktok_handle: str | None = None) -> models.User:
    """Creates a guest user with the given email, or retrieves existing."""
    # Check if exists first
    existing = await get_user_by_email(db, email)
    if existing:
        # Update tiktok handle if provided and not set
        if tiktok_handle and not existing.tiktok_username:
            existing.tiktok_username = tiktok_handle
            await db.commit()
            await db.refresh(existing)
        return existing
        
    new_user = models.User(
        email=email,
        username="Guest", # Default username
        is_guest=True,
        is_verified=False,
        discord_id=None,
        tiktok_username=tiktok_handle
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

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
        .options(
            joinedload(models.User.reviewer_profile).options(
                selectinload(models.Reviewer.payment_configs),
                selectinload(models.Reviewer.economy_configs)
            )
        )
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

async def remove_reviewer_profile(db: AsyncSession, reviewer_id: int) -> str | None:
    """Removes a reviewer profile from a user."""
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer_profile = result.scalars().first()
    if not reviewer_profile:
        return False

    channel_id = reviewer_profile.discord_channel_id
    await db.delete(reviewer_profile)
    await db.commit()
    return channel_id

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
    if expires_in is not None:
        user.spotify_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    else:
        user.spotify_token_expires_at = None
    await db.commit()
    await db.refresh(user)
    return user


def is_spotify_token_expired(user: models.User) -> bool:
    """Checks if the user's Spotify access token is expired or close to expiring."""
    if not user.spotify_token_expires_at:
        return True
    return datetime.now(timezone.utc) >= user.spotify_token_expires_at


async def check_guild_membership(user_discord_id: str, guild_id: str) -> bool:
    """
    Checks if a user is a member of the specified Discord guild.
    Uses the bot instance if available.
    """
    if not user_discord_id or not guild_id:
        return False

    try:
        import bot_instance
        if bot_instance.bot and bot_instance.bot.is_ready():
            guild = bot_instance.bot.get_guild(int(guild_id))
            if guild:
                member = guild.get_member(int(user_discord_id))
                if member:
                    return True
                # If not found in cache, try fetching (async)
                try:
                    member = await guild.fetch_member(int(user_discord_id))
                    return True
                except:
                    return False
    except Exception as e:
        # logging.error(f"Error checking guild membership: {e}")
        pass
    
    return False

async def is_user_authorized_for_line(db: AsyncSession, user_discord_id: str) -> bool:
    """
    Checks if the user is authorized to see the line (member of the configured guild).
    """
    stmt = select(models.GlobalConfig).filter(models.GlobalConfig.key == "authorized_guild_id")
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    authorized_guild_id = config.value if config else None
    
    if not authorized_guild_id:
        return False # Or True if no guild configured? Prompt implies restriction. "if they are not a current member... which the admin controls". Implies if admin hasn't set it, maybe no one sees it? Or everyone? Let's assume False (secure by default).
        
    return await check_guild_membership(user_discord_id, str(authorized_guild_id))

