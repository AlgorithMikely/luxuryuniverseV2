from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from bot_instance import bot as bot_instance
from database import get_db
import schemas
import security
from services import user_service
import models

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    # dependencies=[Depends(security.require_admin)],  # Temporarily commented out
)

# Add this test endpoint
@router.get("/test")
async def test_endpoint():
    """Test endpoint without any dependencies"""
    return {"message": "Admin API is working!"}

@router.get("/reviewers", response_model=list[schemas.UserProfile])
async def get_all_reviewers(db: Session = Depends(get_db)):
    """Fetch all users with reviewer profiles."""
    return user_service.get_all_reviewers(db)

@router.post("/reviewers", response_model=schemas.UserProfile)
async def add_reviewer(
    reviewer_data: schemas.ReviewerCreate, 
    db: Session = Depends(get_db)
):
    """Assign reviewer status to a user."""
    try:
        print(f"Received reviewer data: {reviewer_data}")
        
        # First try to find user in main users table
        db_user = user_service.get_user_by_discord_id(db, reviewer_data.discord_id)
        
        if not db_user:
            # If not found, check if they exist in Discord cache
            discord_user = db.query(models.DiscordUserCache).filter(
                models.DiscordUserCache.discord_id == reviewer_data.discord_id
            ).first()
            
            if discord_user:
                # Create a new user from Discord cache
                db_user = models.User(
                    discord_id=discord_user.discord_id,
                    username=discord_user.username
                )
                db.add(db_user)
                db.commit()
                db.refresh(db_user)
                print(f"Created new user from Discord cache: {db_user.username}")
            else:
                # If not found anywhere, return error with more details
                available_users = user_service.get_all_discord_users(db)
                discord_ids = [user.discord_id for user in available_users]
                raise HTTPException(
                    status_code=404, 
                    detail=f"User with Discord ID {reviewer_data.discord_id} not found. Available Discord IDs: {discord_ids[:5]}"
                )

        print(f"Found/created user: {db_user.id}, {db_user.username}")
        
        result = user_service.add_reviewer_profile(
            db, user=db_user, tiktok_handle=reviewer_data.tiktok_handle
        )
        
        print(f"Added reviewer profile successfully for user {result.username}")
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Error in add_reviewer: {e}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reviewers/{reviewer_id}", status_code=204)
async def remove_reviewer(reviewer_id: int, db: Session = Depends(get_db)):
    """Remove reviewer status from a user."""
    success = user_service.remove_reviewer_profile(db, reviewer_id=reviewer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reviewer profile not found")
    return {"ok": True}

@router.get("/discord-users", response_model=list[schemas.DiscordUser])
async def get_discord_users(db: Session = Depends(get_db)):
    """Fetch all cached Discord users."""
    return user_service.get_all_discord_users(db)