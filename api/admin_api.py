from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
import schemas
import security
from services import user_service
import models

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
async def get_all_reviewers(db: AsyncSession = Depends(get_db)):
    """Fetch all users with reviewer profiles."""
    return await user_service.get_all_reviewers(db)

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

        # The service now handles re-fetching the user with the profile loaded
        result = await user_service.add_reviewer_profile(
            db, user=db_user, tiktok_handle=reviewer_data.tiktok_handle
        )

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
                    await channel.delete(reason="Reviewer profile removed via Admin API")
                    
                    # Also try to delete the category if it's empty
                    if channel.category and len(channel.category.channels) == 0:
                         print(f"Deleting empty category {channel.category.name}")
                         await channel.category.delete(reason="Category empty after reviewer removal")
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
