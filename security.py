from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
import schemas
import models
from database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception) -> str:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], options={"verify_exp": True})
        discord_id: str = payload.get("sub")
        if discord_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return discord_id

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> schemas.TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    discord_id = verify_token(token, credentials_exception)
    user = db.query(models.User).filter(models.User.discord_id == discord_id).first()
    if user is None:
        raise credentials_exception

    # Dynamically determine roles
    roles = []
    if str(user.discord_id) in settings.ADMIN_DISCORD_IDS:
        roles.append("admin")

    reviewer_profile = db.query(models.Reviewer).filter(models.Reviewer.user_id == user.id).first()
    if reviewer_profile:
        roles.append("reviewer")

    return schemas.TokenData(discord_id=discord_id, roles=roles)
