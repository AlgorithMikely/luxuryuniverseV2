from pydantic import BaseModel
from typing import List
from typing import Optional

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

# In schemas.py, you should have something like:
class ReviewerCreate(BaseModel):
    discord_id: str
    tiktok_handle: Optional[str] = None

class ReviewCreate(BaseModel):
    score: int
    notes: Optional[str] = None

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
    model_config = ConfigDict(from_attributes=True)

class Submission(BaseModel):
    id: int
    track_url: str
    track_title: Optional[str] = None
    archived_url: Optional[str] = None
    status: str
    user: User
    model_config = ConfigDict(from_attributes=True)