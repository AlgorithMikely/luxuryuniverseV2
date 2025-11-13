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
    score: Optional[int] = None
    notes: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    discord_id: str | None = None
    username: str | None = None
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
    bookmarked: bool = False
    spotlighted: bool = False
    model_config = ConfigDict(from_attributes=True)

class ReviewSessionBase(BaseModel):
    name: str

class ReviewSessionCreate(ReviewSessionBase):
    pass

class ReviewSessionUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    open_queue_tiers: Optional[List[int]] = None

class ReviewSession(ReviewSessionBase):
    id: int
    reviewer_id: int
    is_active: bool
    submissions: List[Submission] = []
    model_config = ConfigDict(from_attributes=True)

class FullQueueState(BaseModel):
    queue: List[Submission]
    history: List[Submission]
    bookmarks: List[Submission]
    spotlight: List[Submission]