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
    xp: int = 0
    level: int = 0

    model_config = ConfigDict(from_attributes=True)

class PriorityTier(BaseModel):
    value: int
    label: str
    color: str

class ReviewerConfiguration(BaseModel):
    priority_tiers: List[PriorityTier]

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str | None = None
    username: str | None = None
    configuration: Optional[ReviewerConfiguration] = None
    model_config = ConfigDict(from_attributes=True)

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []

class ReviewerCreate(BaseModel):
    discord_id: str
    tiktok_handle: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ReviewerSettingsUpdate(BaseModel):
    tiktok_handle: Optional[str] = None
    discord_channel_id: Optional[str] = None
    configuration: Optional[ReviewerConfiguration] = None

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

    # New fields
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)

class SubmissionUpdate(BaseModel):
    track_title: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    # Fields for user profile update
    tiktok_handle: Optional[str] = None
    instagram_handle: Optional[str] = None # If we add this
    twitter_handle: Optional[str] = None # If we add this

class QueueStats(BaseModel):
    length: int
    avg_wait_time: int # in minutes
    status: str

class QueueStatusUpdate(BaseModel):
    status: str

class ReviewSessionBase(BaseModel):
    name: str

class ReviewSessionCreate(ReviewSessionBase):
    open_queue_tiers: Optional[List[int]] = None

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