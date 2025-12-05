import asyncio
from unittest.mock import MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
import models
import schemas
from security import get_current_active_user
from services import user_service

async def test_admin_auth_fix():
    # Mock DB Session
    db = MagicMock(spec=AsyncSession)
    
    # Mock TokenData with roles
    token_data = schemas.TokenData(
        discord_id="123456789",
        username="TestAdmin",
        roles=["admin", "reviewer"]
    )
    
    # Mock User Service to return a user
    mock_user = models.User(id=1, discord_id="123456789", username="TestAdmin")
    # We need to patch user_service.get_user_by_discord_id
    # Since we can't easily patch the imported module in this script without complex setup,
    # we will rely on the fact that get_current_active_user calls it.
    
    # Actually, let's just mock the service function directly if possible, 
    # or better yet, just manually replicate the logic to ensure the assignment works 
    # if we were to run the function.
    
    # But to test the actual function, we need to mock the awaitable.
    original_get_user = user_service.get_user_by_discord_id
    
    async def mock_get_user(*args, **kwargs):
        return mock_user
        
    user_service.get_user_by_discord_id = mock_get_user
    
    try:
        print("Calling get_current_active_user...")
        user = await get_current_active_user(token_data, db)
        
        print(f"User returned: {user.username}")
        print(f"User roles: {getattr(user, 'roles', 'MISSING')}")
        
        if hasattr(user, 'roles') and "admin" in user.roles:
            print("SUCCESS: User has 'roles' attribute with 'admin'.")
        else:
            print("FAILURE: User missing roles or admin role.")
            
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        # Restore
        user_service.get_user_by_discord_id = original_get_user

if __name__ == "__main__":
    asyncio.run(test_admin_auth_fix())
