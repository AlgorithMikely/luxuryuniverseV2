from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import datetime

class ReviewerConfiguration(BaseModel):
    active_playlist_id: Optional[str] = None
    model_config = ConfigDict(extra='allow')

class PaymentConfig(BaseModel):
    id: int
    reviewer_id: int
    provider: str
    is_enabled: bool
    credentials: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)

class PaymentConfigUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    credentials: Optional[dict] = None

    configuration: Optional[ReviewerConfiguration] = None

class ReviewerCreate(BaseModel):
    discord_id: str
    tiktok_handle: str

class ReviewerSettingsUpdate(BaseModel):
    tiktok_handle: Optional[str] = None
    discord_channel_id: Optional[str] = None
    configuration: Optional[ReviewerConfiguration] = None



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
    tiktok_handle: Optional[str] = None
    discord_channel_id: Optional[str] = None
    configuration: Optional[ReviewerConfiguration] = None

class ReviewerProfile(BaseModel):
    id: int
    user_id: int
    tiktok_handle: str
    discord_channel_id: Optional[str] = None
    queue_status: str
    configuration: Optional[ReviewerConfiguration] = None
    payment_configs: List[PaymentConfig] = []
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)

class UserProfile(UserBase):
    id: int
    reviewer_profile: Optional[ReviewerProfile] = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []
    model_config = ConfigDict(from_attributes=True)

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
    # reviewer field removed from base to avoid lazy load errors
    bookmarked: bool = False
    spotlighted: bool = False
    priority_value: int = 0

    # New fields
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)

class SubmissionWithReviewer(Submission):
    reviewer: Optional[ReviewerProfile] = None

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

class Transaction(BaseModel):
    id: int
    amount: int
    reason: str
    timestamp: datetime.datetime
    model_config = ConfigDict(from_attributes=True)

class PaymentIntentCreate(BaseModel):
    amount: int
    currency: str = "usd"

class PaymentIntentResponse(BaseModel):
    client_secret: str