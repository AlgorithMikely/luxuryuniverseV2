from pydantic import BaseModel, ConfigDict
from typing import List, Optional
import datetime

class PriorityTier(BaseModel):
    value: float
    label: str
    color: str
    description: Optional[str] = None
    tier_name: Optional[str] = None
    submissions_count: Optional[int] = 1

class CommunityGoal(BaseModel):
    type: str
    target: int
    current: int
    description: Optional[str] = None

class ReviewerConfiguration(BaseModel):
    active_playlist_id: Optional[str] = None
    free_line_limit: Optional[int] = None
    line_show_skips: bool = True
    priority_tiers: Optional[List[PriorityTier]] = None
    community_goal: Optional[CommunityGoal] = None
    banner_url: Optional[str] = None
    banner_r2_uri: Optional[str] = None
    theme_color: Optional[str] = None
    social_link_url: Optional[str] = None
    social_link_text: Optional[str] = None
    social_platform: Optional[str] = None
    social_handle: Optional[str] = None
    max_free_submissions_session: Optional[int] = None
    model_config = ConfigDict(extra='allow')

class PaymentConfig(BaseModel):
    id: int
    reviewer_id: int
    provider: str
    is_enabled: bool
    credentials: Optional[dict] = None
    model_config = ConfigDict(from_attributes=True)

class EconomyConfig(BaseModel):
    id: int
    reviewer_id: int
    event_name: str
    coin_amount: int
    model_config = ConfigDict(from_attributes=True)

class EconomyConfigUpdate(BaseModel):
    event_name: str
    coin_amount: int

class Transaction(BaseModel):
    id: int
    reviewer_id: Optional[int] = None
    user_id: Optional[int] = None
    event_name: str
    coin_amount: int
    timestamp: datetime.datetime
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
    see_the_line_channel_id: Optional[str] = None
    configuration: Optional[ReviewerConfiguration] = None
    economy_configs: Optional[List[EconomyConfigUpdate]] = None
    avatar_url: Optional[str] = None
    avatar_r2_uri: Optional[str] = None
    bio: Optional[str] = None
    community_goal_cooldown_minutes: Optional[int] = None


class Achievement(BaseModel):
    id: str
    slug: str
    display_name: str
    description: Optional[str] = None
    category: str
    threshold_value: int
    tier: int = 1
    is_hidden: bool = False
    icon_url: Optional[str] = None
    role_color: Optional[str] = None
    role_icon: Optional[str] = None
    unlocked_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    discord_id: Optional[str] = None
    username: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    is_guest: bool = False
    is_verified: bool = False
    
    # New Settings Fields
    artist_name: Optional[str] = None
    instagram_handle: Optional[str] = None
    twitter_handle: Optional[str] = None
    youtube_channel: Optional[str] = None
    soundcloud_url: Optional[str] = None
    apple_music_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserSettingsUpdate(BaseModel):
    artist_name: Optional[str] = None
    tiktok_username: Optional[str] = None
    instagram_handle: Optional[str] = None
    twitter_handle: Optional[str] = None
    youtube_channel: Optional[str] = None
    soundcloud_url: Optional[str] = None
    apple_music_url: Optional[str] = None

class User(UserBase):
    id: int
    xp: int = 0
    level: int = 0

    model_config = ConfigDict(from_attributes=True)
    tiktok_username: Optional[str] = None

class UserPublic(BaseModel):
    """
    Safe user profile for public endpoints (no email/PII).
    """
    id: int
    username: str
    avatar: Optional[str] = None
    xp: int = 0
    level: int = 0
    tiktok_username: Optional[str] = None
    is_guest: bool = False
    is_verified: bool = False
    discord_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ReviewerProfile(BaseModel):
    id: int
    user_id: int
    tiktok_handle: Optional[str] = None
    discord_channel_id: Optional[str] = None
    see_the_line_channel_id: Optional[str] = None
    queue_status: str
    open_queue_tiers: Optional[List[int]] = None
    configuration: Optional[ReviewerConfiguration] = None
    payment_configs: List[PaymentConfig] = []
    economy_configs: List[EconomyConfig] = []
    user: Optional[User] = None
    payment_configs: List[PaymentConfig] = []
    economy_configs: List[EconomyConfig] = []
    user: Optional[User] = None
    avatar_url: Optional[str] = None
    avatar_r2_uri: Optional[str] = None
    bio: Optional[str] = None
    community_goal_cooldown_minutes: int = 5

    avg_concurrent_viewers: int = 0
    max_concurrent_viewers: int = 0
    avg_total_viewers: int = 0
    max_total_viewers: int = 0
    is_live: bool = False

    model_config = ConfigDict(from_attributes=True)

class UserProfile(UserBase):
    id: int
    reviewer_profile: Optional[ReviewerProfile] = None
    roles: List[str] = []
    moderated_reviewers: List[ReviewerProfile] = []
    spotify_connected: bool = False
    achievements: List[Achievement] = [] # List of unlocked achievements
    is_line_authorized: bool = False
    tiktok_username: Optional[str] = None
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

class DiscordChannel(BaseModel):
    id: str
    name: str
    type: str
    category: Optional[str] = None

class Submission(BaseModel):
    id: int
    reviewer_id: int
    track_url: str
    track_title: Optional[str] = None
    artist: Optional[str] = None
    archived_url: Optional[str] = None
    status: str
    score: Optional[float] = None
    notes: Optional[str] = None
    user: User
    # reviewer field removed from base to avoid lazy load errors
    bookmarked: bool = False
    spotlighted: bool = False
    is_community_winner: Optional[bool] = False
    priority_value: int = 0

    # New fields
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None

    # New Smart-Zone fields
    batch_id: Optional[str] = None
    sequence_order: int = 1
    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None
    submitted_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SubmissionPublic(Submission):
    """
    Public submission data with sanitized user info.
    """
    user: UserPublic

class SubmissionWithReviewer(Submission):
    reviewer: Optional[ReviewerProfile] = None

class SubmissionUpdate(BaseModel):
    track_title: Optional[str] = None
    artist: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    # Fields for user profile update
    tiktok_handle: Optional[str] = None
    instagram_handle: Optional[str] = None # If we add this
    twitter_handle: Optional[str] = None # If we add this

    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None

class SmartSubmissionItem(BaseModel):
    track_url: str
    track_title: Optional[str] = None
    artist: Optional[str] = None
    genre: Optional[str] = None
    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None
    priority_value: int = 0 # Individual priority if needed, but usually batch uses the same
    sequence_order: int = 1

class SmartSubmissionCreate(BaseModel):
    submissions: List[SmartSubmissionItem]
    is_priority: bool = False
    total_cost: int = 0 # For verification

class RecentTrack(BaseModel):
    id: int
    track_title: str
    artist_name: Optional[str] = None # Derived from user.username usually, but distinct logic might use submission user
    cover_art_url: Optional[str] = None
    file_url: str # track_url
    hook_start_time: Optional[int] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

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

class GiveawayState(BaseModel):
    is_active: bool
    progress: int
    target: int
    winner: Optional[UserPublic] = None
    cooldown_end: Optional[datetime.datetime] = None
    description: Optional[str] = None

class FullQueueState(BaseModel):
    queue: List[Submission]
    history: List[Submission]
    bookmarks: List[Submission]
    spotlight: List[Submission]
    current_track: Optional[Submission] = None
    is_live: bool = False
    giveaway_state: Optional[GiveawayState] = None

class FreeQueueData(BaseModel):
    display_limit: int
    total_waiting: int
    items: List[Submission]

class QueueData(BaseModel):
    priority_queue: List[Submission]
    free_queue: FreeQueueData

class UserContext(BaseModel):
    reason: str
    meta_data: Optional[dict] = None
    timestamp: datetime.datetime
    
    # Optional nested models if we want full details
    user: Optional[UserPublic] = None
    
    model_config = ConfigDict(from_attributes=True)

class PaymentIntentCreate(BaseModel):
    amount: int
    currency: str = "usd"
    email: Optional[str] = None
    tier: Optional[str] = None
    track_url: Optional[str] = None
    track_title: Optional[str] = None

class PaymentIntentResponse(BaseModel):
    client_secret: str

class TikTokAccount(BaseModel):
    id: int
    handle_name: str
    points: int = 0
    monitored: bool = False
    user_id: Optional[int] = None
    
    avg_concurrent_viewers: int = 0
    max_concurrent_viewers: int = 0
    avg_total_viewers: int = 0
    max_total_viewers: int = 0

    model_config = ConfigDict(from_attributes=True)

class SubmitterStats(BaseModel):
    user: UserPublic
    average_review_score: float
    average_poll_result: float
    genres: List[str]
    submissions: List[SubmissionPublic]

class MissionBar(BaseModel):
    status: str
    type: str
    target: int
    current: int
    percent: int

class PriorityQueueItem(BaseModel):
    pos: int
    user: str
    type: str  # PAID_PRIORITY, HOT_SEAT
    amount: int
    style: str  # GOLD, FIRE
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    track_url: Optional[str] = None

class FreeQueueItem(BaseModel):
    pos: int
    user: str
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    track_url: Optional[str] = None

class FreeQueue(BaseModel):
    display_limit: int
    total_waiting: int
    items: List[FreeQueueItem]

class NowPlayingInfo(BaseModel):
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    user: UserPublic
    mission_bar: Optional[MissionBar] = None

class LineViewState(BaseModel):
    session_id: Optional[str] = None

    # New Smart-Zone fields
    batch_id: Optional[str] = None
    sequence_order: int = 1
    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None
    submitted_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SubmissionPublic(Submission):
    """
    Public submission data with sanitized user info.
    """
    user: UserPublic

class SubmissionWithReviewer(Submission):
    reviewer: Optional[ReviewerProfile] = None

class SubmissionUpdate(BaseModel):
    track_title: Optional[str] = None
    artist: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    # Fields for user profile update
    tiktok_handle: Optional[str] = None
    instagram_handle: Optional[str] = None # If we add this
    twitter_handle: Optional[str] = None # If we add this

    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None

class SmartSubmissionItem(BaseModel):
    track_url: str
    track_title: Optional[str] = None
    artist: Optional[str] = None
    genre: Optional[str] = None
    hook_start_time: Optional[int] = None
    hook_end_time: Optional[int] = None
    priority_value: int = 0 # Individual priority if needed, but usually batch uses the same
    sequence_order: int = 1

class SmartSubmissionCreate(BaseModel):
    submissions: List[SmartSubmissionItem]
    is_priority: bool = False
    total_cost: int = 0 # For verification

class RecentTrack(BaseModel):
    id: int
    track_title: str
    artist_name: Optional[str] = None # Derived from user.username usually, but distinct logic might use submission user
    cover_art_url: Optional[str] = None
    file_url: str # track_url
    hook_start_time: Optional[int] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

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

class GiveawayState(BaseModel):
    type: str = "LIKES"
    is_active: bool
    progress: int
    target: int
    winner: Optional[UserPublic] = None
    cooldown_end: Optional[datetime.datetime] = None
    description: Optional[str] = None

class FullQueueState(BaseModel):
    queue: List[Submission]
    history: List[Submission]
    bookmarks: List[Submission]
    spotlight: List[Submission]
    current_track: Optional[Submission] = None
    is_live: bool = False
    giveaway_state: Optional[GiveawayState] = None
    community_goals: List[GiveawayState] = []

class FreeQueueData(BaseModel):
    display_limit: int
    total_waiting: int
    items: List[Submission]

class QueueData(BaseModel):
    priority_queue: List[Submission]
    free_queue: FreeQueueData

class UserContext(BaseModel):
    reason: str
    meta_data: Optional[dict] = None
    timestamp: datetime.datetime
    
    # Optional nested models if we want full details
    user: Optional[UserPublic] = None
    
    model_config = ConfigDict(from_attributes=True)

class PaymentIntentCreate(BaseModel):
    amount: int
    currency: str = "usd"
    email: Optional[str] = None
    tier: Optional[str] = None
    track_url: Optional[str] = None
    track_title: Optional[str] = None

class PaymentIntentResponse(BaseModel):
    client_secret: str

class TikTokAccount(BaseModel):
    id: int
    handle_name: str
    points: int = 0
    monitored: bool = False
    user_id: Optional[int] = None
    
    avg_concurrent_viewers: int = 0
    max_concurrent_viewers: int = 0
    avg_total_viewers: int = 0
    max_total_viewers: int = 0

    model_config = ConfigDict(from_attributes=True)

class SubmitterStats(BaseModel):
    user: UserPublic
    average_review_score: float
    average_poll_result: float
    genres: List[str]
    submissions: List[SubmissionPublic]

class MissionBar(BaseModel):
    status: str
    type: str
    target: int
    current: int
    percent: int

class PriorityQueueItem(BaseModel):
    pos: int
    submission_id: int
    user: str
    type: str  # PAID_PRIORITY, HOT_SEAT
    amount: int
    style: str  # GOLD, FIRE
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    track_url: Optional[str] = None
    is_community_winner: Optional[bool] = False

class FreeQueueItem(BaseModel):
    pos: int
    submission_id: int
    user: str
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    track_url: Optional[str] = None

class FreeQueue(BaseModel):
    display_limit: int
    total_waiting: int
    items: List[FreeQueueItem]

class NowPlayingInfo(BaseModel):
    track_title: Optional[str] = None
    artist: Optional[str] = None
    cover_art_url: Optional[str] = None
    user: UserPublic
    mission_bar: Optional[MissionBar] = None

class LineViewState(BaseModel):
    session_id: Optional[str] = None
    status: str
    now_playing: Optional[NowPlayingInfo] = None
    priority_queue: List[PriorityQueueItem]
    free_queue: FreeQueue
    user_status: Optional[dict] = None
    spotlights: List[dict] = []
    is_live: bool
    pricing_tiers: List[PriorityTier]
    giveaway_state: Optional[GiveawayState] = None
    community_goals: List[GiveawayState] = []
    reviewer: Optional[ReviewerProfile] = None
