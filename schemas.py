from pydantic import BaseModel
from typing import List

class UserBase(BaseModel):
    discord_id: str
    username: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str

    class Config:
        from_attributes = True

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    discord_id: str | None = None
    roles: List[str] = []
