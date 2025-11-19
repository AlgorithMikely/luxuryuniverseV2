from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from config import settings
import schemas
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services import user_service
import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception) -> schemas.TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        discord_id: str = payload.get("sub")
        username: str = payload.get("username")
        roles: List[str] = payload.get("roles", [])
        if discord_id is None or username is None:
            raise credentials_exception
        token_data = schemas.TokenData(discord_id=discord_id, username=username, roles=roles)
    except JWTError:
        raise credentials_exception
    return token_data

def get_current_user(token: str = Depends(oauth2_scheme)) -> schemas.TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = verify_token(token, credentials_exception)

    # Dynamically add admin role if the user's discord_id is in the admin list
    if token_data.discord_id in settings.ADMIN_DISCORD_IDS:
        if "admin" not in token_data.roles:
            token_data.roles.append("admin")

    return token_data

# ✅ FIXED: Now async and uses AsyncSession
async def get_current_active_user(
        current_user: schemas.TokenData = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
) -> models.User:
    # We must await this because the service is async
    user = await user_service.get_user_by_discord_id(db, discord_id=current_user.discord_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def require_admin(current_user: schemas.TokenData = Depends(get_current_user)):
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    return current_user
