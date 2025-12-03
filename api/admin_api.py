from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from database import get_db
import schemas
import security
from services import user_service
import models
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(security.require_admin)],
)

# Add this test endpoint
@router.get("/test")
async def test_endpoint():
    """Test endpoint without any dependencies"""
    return {"message": "Admin API is working!"}

@router.get("/reviewers", response_model=list[schemas.UserProfile])
async def get_all_users_admin(db: AsyncSession = Depends(get_db)):
    """
    Fetch all users for admin management. 
    Renamed from get_all_reviewers but keeps route for compatibility, 
    or we can change frontend to filter.
    Actually, let's just return ALL users and let frontend filter.
    """
    # We use a new service method or just query here
    result = await db.execute(
        select(models.User)
        .options(
            joinedload(models.User.reviewer_profile).options(
                selectinload(models.Reviewer.payment_configs),
                selectinload(models.Reviewer.economy_configs)
            ),
            selectinload(models.User.achievements)
        )
    )
    users = result.scalars().all()
    
    # We need to populate roles manually since they aren't in DB
    # This is a bit inefficient if we have many users, but for now it's fine.
    # Ideally we'd have roles in DB.
    # For now, we just return the users. The frontend 'roles' field might be empty 
    # unless we populate it.
    # schemas.UserProfile has 'roles'.
    
    # Let's populate 'admin' role at least
    from config import settings
    
    # Fetch viewer stats for all handles
    from sqlalchemy import func, cast, Integer
    
    # Subquery for concurrent stats per session
    session_concurrent_stats = (
        select(
            models.TikTokInteraction.host_handle,
            models.TikTokInteraction.session_id,
            func.avg(cast(models.TikTokInteraction.value, Integer)).label("session_avg_concurrent"),
            func.max(cast(models.TikTokInteraction.value, Integer)).label("session_max_concurrent")
        )
        .where(models.TikTokInteraction.interaction_type == 'VIEWER_COUNT_UPDATE')
        .group_by(models.TikTokInteraction.host_handle, models.TikTokInteraction.session_id)
        .subquery()
    )

    # Average these session stats per host
    concurrent_stats_query = (
        select(
            session_concurrent_stats.c.host_handle,
            func.avg(session_concurrent_stats.c.session_avg_concurrent).label("avg_concurrent"),
            func.max(session_concurrent_stats.c.session_max_concurrent).label("max_concurrent")
        )
        .group_by(session_concurrent_stats.c.host_handle)
    )
    
    concurrent_results = await db.execute(concurrent_stats_query)
    concurrent_map = {row.host_handle: row for row in concurrent_results.all()}

    # Subquery for total stats per session
    session_total_stats = (
        select(
            models.TikTokInteraction.host_handle,
            models.TikTokInteraction.session_id,
            func.max(cast(models.TikTokInteraction.value, Integer)).label("session_max_total")
        )
        .where(models.TikTokInteraction.interaction_type == 'TOTAL_VIEWERS_UPDATE')
        .group_by(models.TikTokInteraction.host_handle, models.TikTokInteraction.session_id)
        .subquery()
    )

    # Average these session maximums per host
    total_stats_query = (
        select(
            session_total_stats.c.host_handle,
            func.avg(session_total_stats.c.session_max_total).label("avg_total"),
            func.max(session_total_stats.c.session_max_total).label("max_total")
        )
        .group_by(session_total_stats.c.host_handle)
    )
    
    total_results = await db.execute(total_stats_query)
    total_map = {row.host_handle: row for row in total_results.all()}

    user_profiles = []
    for u in users:
        # Patch missing attributes for Pydantic schema validation
        # schemas.User expects 'configuration', but it's not on User model
        if not hasattr(u, 'configuration'):
            setattr(u, 'configuration', None)
            
        roles = []
        if u.reviewer_profile:
            roles.append("reviewer")
            # schemas.ReviewerProfile expects 'open_queue_tiers', but it's not on Reviewer model
            if not hasattr(u.reviewer_profile, 'open_queue_tiers'):
                setattr(u.reviewer_profile, 'open_queue_tiers', [])
            
            # Populate stats
            handle = u.reviewer_profile.tiktok_handle
            if handle:
                # Concurrent stats
                if handle in concurrent_map:
                    stats = concurrent_map[handle]
                    u.reviewer_profile.avg_concurrent_viewers = int(stats.avg_concurrent) if stats.avg_concurrent else 0
                    u.reviewer_profile.max_concurrent_viewers = int(stats.max_concurrent) if stats.max_concurrent else 0
                else:
                    u.reviewer_profile.avg_concurrent_viewers = 0
                    u.reviewer_profile.max_concurrent_viewers = 0
                
                # Total stats
                if handle in total_map:
                    stats = total_map[handle]
                    u.reviewer_profile.avg_total_viewers = int(stats.avg_total) if stats.avg_total else 0
                    u.reviewer_profile.max_total_viewers = int(stats.max_total) if stats.max_total else 0
                else:
                    u.reviewer_profile.avg_total_viewers = 0
                    u.reviewer_profile.max_total_viewers = 0
            else:
                # Initialize defaults if no handle
                u.reviewer_profile.avg_concurrent_viewers = 0
                u.reviewer_profile.max_concurrent_viewers = 0
                u.reviewer_profile.avg_total_viewers = 0
                u.reviewer_profile.max_total_viewers = 0

        if u.discord_id in settings.ADMIN_DISCORD_IDS:
            roles.append("admin")
            
        # Create UserProfile
        # We need to map achievements too if we want them, but maybe not needed for this list
        profile = schemas.UserProfile(
            id=u.id,
            discord_id=u.discord_id,
            username=u.username,
            avatar=u.avatar,
            reviewer_profile=u.reviewer_profile,
            roles=roles,
            spotify_connected=bool(u.spotify_access_token)
        )
        user_profiles.append(profile)
        
    return user_profiles

@router.post("/reviewers", response_model=schemas.UserProfile)
async def add_reviewer(
        reviewer_data: schemas.ReviewerCreate,
        db: AsyncSession = Depends(get_db)
):
    """Assign reviewer status to a user."""
    try:
        print(f"Received reviewer data: {reviewer_data}")

        # First try to find user in main users table
        db_user = await user_service.get_user_by_discord_id(db, reviewer_data.discord_id)

        if not db_user:
            # If not found, check if they exist in Discord cache
            result = await db.execute(
                select(models.DiscordUserCache).filter(
                    models.DiscordUserCache.discord_id == reviewer_data.discord_id
                )
            )
            discord_user = result.scalars().first()

            if discord_user:
                # Create a new user from Discord cache
                db_user = models.User(
                    discord_id=discord_user.discord_id,
                    username=discord_user.username
                )
                db.add(db_user)
                await db.commit()
                await db.refresh(db_user)
                print(f"Created new user from Discord cache: {db_user.username}")
            else:
                # If not found anywhere, return error with more details
                available_users = await user_service.get_all_discord_users(db)
                discord_ids = [user.discord_id for user in available_users]
                raise HTTPException(
                    status_code=404,
                    detail=f"User with Discord ID {reviewer_data.discord_id} not found."
                )

        print(f"Found/created user: {db_user.id}, {db_user.username}")

        # Check for existing handle to detect changes
        old_handle = None
        if db_user.reviewer_profile:
            old_handle = db_user.reviewer_profile.tiktok_handle

        # The service now handles re-fetching the user with the profile loaded
        result = await user_service.add_reviewer_profile(
            db, user=db_user, tiktok_handle=reviewer_data.tiktok_handle
        )

        # Check if TikTok handle changed/added and update monitoring dynamically
        new_handle = reviewer_data.tiktok_handle
        
        # Normalize for comparison
        old_h_norm = old_handle.lower() if old_handle else ""
        new_h_norm = new_handle.lower() if new_handle else ""

        if old_h_norm != new_h_norm:
            print(f"TikTok handle changed from {old_handle} to {new_handle} via Admin. Updating monitoring...")
            try:
                import bot_instance
                if bot_instance.bot and bot_instance.bot.is_ready():
                    tiktok_cog = bot_instance.bot.get_cog("TikTokCog")
                    if tiktok_cog:
                        # Stop tracking old handle
                        if old_handle:
                            await tiktok_cog.update_monitoring(old_handle, False)
                        # Start tracking new handle
                        if new_handle:
                            await tiktok_cog.update_monitoring(new_handle, True)
                    else:
                        print("TikTokCog not found when updating reviewer handle via Admin")
                else:
                     print("Bot not ready or not found when updating reviewer handle via Admin")
            except Exception as e:
                print(f"Error updating monitoring via Admin: {e}")

        print(f"Added reviewer profile successfully for user {result.username}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in add_reviewer: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reviewers/{reviewer_id}", status_code=204)
async def remove_reviewer(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """Remove reviewer status from a user."""
    # The service returns the discord_channel_id if found, or False/None if not found
    channel_id = await user_service.remove_reviewer_profile(db, reviewer_id=reviewer_id)
    
    if channel_id is False: # Handle the case where user wasn't found
         raise HTTPException(status_code=404, detail="Reviewer profile not found")

    # Trigger Discord channel deletion if a channel ID was associated
    if channel_id:
        try:
            import bot_instance
            if bot_instance.bot:
                channel = bot_instance.bot.get_channel(int(channel_id))
                if channel:
                    print(f"Deleting Discord channel {channel_id} for removed reviewer {reviewer_id}")
                    # DISABLED: To prevent accidental deletion of channels.
                    # await channel.delete(reason="Reviewer profile removed via Admin API")
                    print(f"SKIPPING deletion of Discord channel {channel_id} (Safety Lock)")
                    
                    # Also try to delete the category if it's empty
                    if channel.category and len(channel.category.channels) == 0:
                         print(f"Deleting empty category {channel.category.name}")
                         # DISABLED: To prevent accidental deletion of categories.
                         # await channel.category.delete(reason="Category empty after reviewer removal")
                         print(f"SKIPPING deletion of category {channel.category.name} (Safety Lock)")
                else:
                    print(f"Discord channel {channel_id} not found in cache, skipping deletion.")
        except Exception as e:
            print(f"Failed to delete Discord channel {channel_id}: {e}")
            # We don't raise an error here because the DB deletion was successful

    return {"ok": True}

@router.get("/discord-users", response_model=list[schemas.DiscordUser])
async def get_discord_users(db: AsyncSession = Depends(get_db)):
    """Fetch all cached Discord users."""
    return await user_service.get_all_discord_users(db)

@router.get("/tiktok-accounts", response_model=list[schemas.TikTokAccount])
async def get_tiktok_accounts(db: AsyncSession = Depends(get_db)):
    """Fetch all TikTok accounts with viewer stats."""
    # We need to aggregate viewer stats from TikTokInteraction
    # We join on handle_name == host_handle
    
    # Note: value is stored as string in TikTokInteraction, so we cast to Integer
    # We only care about interaction_type='VIEWER_COUNT_UPDATE'
    
    from sqlalchemy import func, cast, Integer, case
    
    # Subquery for concurrent stats per session
    # First, get the average concurrent viewers for each session
    session_concurrent_stats = (
        select(
            models.TikTokInteraction.host_handle,
            models.TikTokInteraction.session_id,
            func.avg(cast(models.TikTokInteraction.value, Integer)).label("session_avg_concurrent"),
            func.max(cast(models.TikTokInteraction.value, Integer)).label("session_max_concurrent")
        )
        .where(models.TikTokInteraction.interaction_type == 'VIEWER_COUNT_UPDATE')
        .group_by(models.TikTokInteraction.host_handle, models.TikTokInteraction.session_id)
        .subquery()
    )

    # Then, average these session stats per host
    concurrent_stats = (
        select(
            session_concurrent_stats.c.host_handle,
            func.avg(session_concurrent_stats.c.session_avg_concurrent).label("avg_concurrent"),
            func.max(session_concurrent_stats.c.session_max_concurrent).label("max_concurrent")
        )
        .group_by(session_concurrent_stats.c.host_handle)
        .subquery()
    )

    # Subquery for total stats per session
    # First, get the max total viewers for each session
    session_total_stats = (
        select(
            models.TikTokInteraction.host_handle,
            models.TikTokInteraction.session_id,
            func.max(cast(models.TikTokInteraction.value, Integer)).label("session_max_total")
        )
        .where(models.TikTokInteraction.interaction_type == 'TOTAL_VIEWERS_UPDATE')
        .group_by(models.TikTokInteraction.host_handle, models.TikTokInteraction.session_id)
        .subquery()
    )

    # Then, average these session maximums per host
    total_stats = (
        select(
            session_total_stats.c.host_handle,
            func.avg(session_total_stats.c.session_max_total).label("avg_total"),
            func.max(session_total_stats.c.session_max_total).label("max_total")
        )
        .group_by(session_total_stats.c.host_handle)
        .subquery()
    )

    # Main query
    stmt = (
        select(
            models.TikTokAccount, 
            concurrent_stats.c.avg_concurrent, 
            concurrent_stats.c.max_concurrent,
            total_stats.c.avg_total,
            total_stats.c.max_total
        )
        .outerjoin(concurrent_stats, models.TikTokAccount.handle_name == concurrent_stats.c.host_handle)
        .outerjoin(total_stats, models.TikTokAccount.handle_name == total_stats.c.host_handle)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    accounts = []
    for row in rows:
        account = row[0]
        avg_concurrent = int(row[1]) if row[1] else 0
        max_concurrent = int(row[2]) if row[2] else 0
        avg_total = int(row[3]) if row[3] else 0
        max_total = int(row[4]) if row[4] else 0
        
        account_dict = {
            "id": account.id,
            "handle_name": account.handle_name,
            "points": account.points,
            "monitored": account.monitored,
            "user_id": account.user_id,
            "avg_concurrent_viewers": avg_concurrent,
            "max_concurrent_viewers": max_concurrent,
            "avg_total_viewers": avg_total,
            "max_total_viewers": max_total
        }
        accounts.append(account_dict)
        
    return accounts

@router.delete("/tiktok-accounts/{account_id}", status_code=204)
async def remove_tiktok_account(account_id: int, db: AsyncSession = Depends(get_db)):
    """Remove a TikTok account and disconnect it."""
    # 1. Get the account
    result = await db.execute(select(models.TikTokAccount).filter(models.TikTokAccount.id == account_id))
    account = result.scalars().first()
    
    if not account:
        raise HTTPException(status_code=404, detail="TikTok account not found")

    handle_name = account.handle_name

    # 2. Delete related interactions first (Foreign Key Constraint)
    await db.execute(
        sqlalchemy.delete(models.TikTokInteraction).where(models.TikTokInteraction.tiktok_account_id == account_id)
    )

    # 3. Delete from DB
    await db.delete(account)
    await db.commit()

    # 3. Disconnect via Bot
    try:
        import bot_instance
        if bot_instance.bot:
            tiktok_cog = bot_instance.bot.get_cog('TikTokCog')
            if tiktok_cog:
                await tiktok_cog.disconnect_account(handle_name)
                print(f"Disconnected TikTok account {handle_name} via bot.")
            else:
                print("TikTokCog not found, skipping bot disconnect.")
        else:
             print("Bot instance not ready, skipping bot disconnect.")
    except Exception as e:
        print(f"Failed to disconnect TikTok account {handle_name}: {e}")
        # We don't fail the request since DB deletion was successful

    return {"ok": True}

class TikTokAccountUpdate(BaseModel):
    monitored: bool

class TikTokAccountCreate(BaseModel):
    handle_name: str

@router.post("/tiktok-accounts", response_model=schemas.TikTokAccount)
async def create_tiktok_account(
    account_data: TikTokAccountCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new TikTok account and start monitoring it."""
    # Check if exists
    result = await db.execute(select(models.TikTokAccount).filter(models.TikTokAccount.handle_name == account_data.handle_name))
    existing = result.scalars().first()
    
    if existing:
        if not existing.monitored:
             existing.monitored = True
             await db.commit()
             await db.refresh(existing)
             # Notify bot
             try:
                import bot_instance
                if bot_instance.bot:
                    tiktok_cog = bot_instance.bot.get_cog('TikTokCog')
                    if tiktok_cog:
                        await tiktok_cog.update_monitoring(existing.handle_name, True)
             except:
                 pass
             return existing
        else:
             raise HTTPException(status_code=400, detail="Account already exists and is monitored")

    # Create new
    new_account = models.TikTokAccount(
        handle_name=account_data.handle_name,
        monitored=True
    )
    db.add(new_account)
    await db.commit()
    await db.refresh(new_account)

    # Notify Bot
    try:
        import bot_instance
        if bot_instance.bot:
            tiktok_cog = bot_instance.bot.get_cog('TikTokCog')
            if tiktok_cog:
                await tiktok_cog.update_monitoring(new_account.handle_name, True)
                print(f"Started monitoring for {new_account.handle_name}")
            else:
                print("TikTokCog not found, skipping bot update.")
        else:
             print("Bot instance not ready, skipping bot update.")
    except Exception as e:
        print(f"Failed to start bot monitoring for {new_account.handle_name}: {e}")

    return new_account

@router.patch("/tiktok-accounts/{account_id}")
async def update_tiktok_account(
    account_id: int, 
    update_data: TikTokAccountUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a TikTok account's monitoring status."""
    # 1. Get the account
    result = await db.execute(select(models.TikTokAccount).filter(models.TikTokAccount.id == account_id))
    account = result.scalars().first()
    
    if not account:
        raise HTTPException(status_code=404, detail="TikTok account not found")

    # 2. Update DB
    account.monitored = update_data.monitored
    await db.commit()
    await db.refresh(account)

    # 3. Notify Bot
    try:
        import bot_instance
        if bot_instance.bot:
            tiktok_cog = bot_instance.bot.get_cog('TikTokCog')
            if tiktok_cog:
                await tiktok_cog.update_monitoring(account.handle_name, account.monitored)
                print(f"Updated monitoring for {account.handle_name} to {account.monitored}")
            else:
                print("TikTokCog not found, skipping bot update.")
        else:
             print("Bot instance not ready, skipping bot update.")
    except Exception as e:
        print(f"Failed to update bot monitoring for {account.handle_name}: {e}")
        # We don't fail the request since DB update was successful

    return account

@router.get("/discord/channels", response_model=list[schemas.DiscordChannel])
async def get_discord_channels_admin(db: AsyncSession = Depends(get_db)):
    """
    Fetches available text and voice channels from the Discord guild for admin use.
    """
    from bot_instance import bot
    import discord
    
    if not bot or not bot.is_ready():
         raise HTTPException(status_code=503, detail="Discord bot is not ready")

    # We need to find the guild. 
    # Default to first guild for now
    guild = None
    if bot.guilds:
        guild = bot.guilds[0]
    
    if not guild:
        raise HTTPException(status_code=404, detail="Bot is not in any guild")

    channels = []
    for channel in guild.channels:
        if isinstance(channel, (discord.TextChannel, discord.VoiceChannel)):
             channels.append({
                 "id": str(channel.id),
                 "name": channel.name,
                 "type": "text" if isinstance(channel, discord.TextChannel) else "voice",
                 "category": channel.category.name if channel.category else None
             })
    
    return channels

class GlobalSettingsUpdate(BaseModel):
    authorized_guild_id: Optional[str] = None

@router.get("/global-settings")
async def get_global_settings(db: AsyncSession = Depends(get_db)):
    """Fetch global settings."""
    stmt = select(models.GlobalConfig).filter(models.GlobalConfig.key == "authorized_guild_id")
    result = await db.execute(stmt)
    config = result.scalars().first()
    
    return {
        "authorized_guild_id": config.value if config else None
    }

@router.patch("/global-settings")
async def update_global_settings(
    settings: GlobalSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update global settings."""
    if settings.authorized_guild_id is not None:
        # Update or Create
        stmt = select(models.GlobalConfig).filter(models.GlobalConfig.key == "authorized_guild_id")
        result = await db.execute(stmt)
        config = result.scalars().first()
        
        if config:
            config.value = settings.authorized_guild_id
        else:
            config = models.GlobalConfig(key="authorized_guild_id", value=settings.authorized_guild_id)
            db.add(config)
            
        await db.commit()
        
    return {"ok": True}

    return {"ok": True}


@router.get("/platform-fees")
async def get_platform_fees(db: AsyncSession = Depends(get_db)):
    """Fetch all platform fees."""
    stmt = (
        select(models.PlatformFee)
        .options(joinedload(models.PlatformFee.reviewer).joinedload(models.Reviewer.user))
        .order_by(models.PlatformFee.created_at.desc())
    )
    result = await db.execute(stmt)
    fees = result.scalars().all()
    
    return [
        {
            "id": fee.id,
            "reviewer_name": fee.reviewer.user.username if fee.reviewer and fee.reviewer.user else "Unknown",
            "amount": fee.amount,
            "currency": fee.currency,
            "source": fee.source,
            "reference_id": fee.reference_id,
            "is_settled": fee.is_settled,
            "created_at": fee.created_at
        }
        for fee in fees
    ]
