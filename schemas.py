from pydantic import BaseModel
from typing import List

class UserBase(BaseModel):
    discord_id: str
    username: str

class UserCreate(UserBase):
    pass

from pydantic import ConfigDict

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str | None = None
    model_config = ConfigDict(from_attributes=True)

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []

class ReviewerCreate(BaseModel):
    discord_id: str
    discord_channel_id: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    discord_id: str | None = None
    roles: List[str] = []


class DiscordUser(BaseModel):
    id: int
    discord_id: str
    username: str

    class Config:
        from_attributes = True
