from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class UserBase(BaseModel):
    discord_id: str
    username: str
    avatar: Optional[str] = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str | None = None
    username: str | None = None
    model_config = ConfigDict(from_attributes=True)

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []

class ReviewerCreate(BaseModel):
    discord_id: str
    tiktok_handle: Optional[str] = None

class ReviewCreate(BaseModel):
    score: Optional[float] = None
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
    reviewer_id: int
    track_url: str
    track_title: Optional[str] = None
    archived_url: Optional[str] = None
    status: str
    score: Optional[float] = None
    notes: Optional[str] = None
    user: User
    bookmarked: bool = False
    spotlighted: bool = False
    priority_value: int = 0
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
    open_queue_tiers: List[int] = [0, 5, 10, 15, 20, 25, 50]
    submissions: List[Submission] = []
    model_config = ConfigDict(from_attributes=True)

class FullQueueState(BaseModel):
    queue: List[Submission]
    history: List[Submission]
    bookmarks: List[Submission]
    spotlight: List[Submission]
    current_track: Optional[Submission] = None