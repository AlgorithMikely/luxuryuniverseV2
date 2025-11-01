import datetime
from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class UserBase(BaseModel):
    discord_id: str
    username: str


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    tiktok_username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: Optional[str] = None
    discord_channel_id: str

    model_config = ConfigDict(from_attributes=True)


class UserProfile(User):
    reviewer_profile: Optional[ReviewerProfile] = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []


class Submission(BaseModel):
    id: int
    track_url: str
    status: str
    submitted_at: datetime.datetime
    user: User

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    discord_id: Optional[str] = None
    roles: List[str] = []
