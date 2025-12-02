from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Index,
    Boolean,
    Float,
    BigInteger,
    Numeric
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import datetime
import json
from sqlalchemy.types import TypeDecorator, TEXT
# from sqlalchemy.dialects.postgresql import JSON # Removed to use custom type for SQLite compat
from custom_types import JSON # Import our custom type

Base = declarative_base()

# Custom type required by Alembic migration file
class JsonEncodedList(TypeDecorator):
    """
    Stores Python lists as JSON strings in the database.
    Used for backward compatibility with older migrations.
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            if isinstance(value, (list, dict)):
                return value
            return json.loads(value)
        return None


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    is_guest = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    username = Column(String, nullable=False)
    tiktok_username = Column(String, unique=True, nullable=True)
    spotify_access_token = Column(String, nullable=True)
    spotify_refresh_token = Column(String, nullable=True)
    spotify_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    avatar = Column(String, nullable=True)
    xp = Column(Integer, default=0, nullable=False)

    # Gamification Stats
    discord_user_id = Column(String, nullable=True)
    lifetime_live_likes = Column(BigInteger, default=0)
    lifetime_diamonds = Column(BigInteger, default=0)
    total_submissions_graded = Column(Integer, default=0)
    average_review_score = Column(Numeric(4, 2), default=0.00)
    discord_msg_count = Column(BigInteger, default=0)
    discord_voice_mins = Column(BigInteger, default=0)
    lifetime_likes_sent = Column(BigInteger, default=0)
    lifetime_gifts_sent = Column(BigInteger, default=0)
    lifetime_tiktok_comments = Column(BigInteger, default=0)
    lifetime_tiktok_shares = Column(BigInteger, default=0)

    # Generic Gamification Stats (JSON)
    # Stores: poll_votes, consec_wins, unique_tags, etc.
    gamification_stats = Column(JSON, default={}, nullable=True)

    reviewer_profile = relationship("Reviewer", back_populates="user", uselist=False)
    submissions = relationship("Submission", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")
    live_sessions = relationship("LiveSession", back_populates="user")


class Reviewer(Base):
    __tablename__ = "reviewers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tiktok_handle = Column(String, unique=True)
    discord_channel_id = Column(String, unique=True, nullable=True)
    see_the_line_channel_id = Column(String, unique=True, nullable=True)
    queue_status = Column(String, default="closed", nullable=False)
    configuration = Column(JSON, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)

    user = relationship("User", back_populates="reviewer_profile")
    submissions = relationship("Submission", back_populates="reviewer")
    economy_configs = relationship("EconomyConfig", back_populates="reviewer", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="reviewer")
    payment_configs = relationship("PaymentConfig", back_populates="reviewer", cascade="all, delete-orphan")

    @property
    def username(self):
        return self.user.username if self.user else None


class PaymentConfig(Base):
    __tablename__ = "payment_configs"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    provider = Column(String, nullable=False) # e.g. "stripe", "paypal"
    is_enabled = Column(Boolean, default=False, nullable=False)
    credentials = Column(JSON, nullable=True)

    reviewer = relationship("Reviewer", back_populates="payment_configs")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=True)
    track_url = Column(String, nullable=False)
    track_title = Column(String, nullable=True)
    artist = Column(String, nullable=True)
    archived_url = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC))
    score = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    is_priority = Column(Boolean, default=False, nullable=False)
    priority_value = Column(Integer, default=0, nullable=False)
    bookmarked = Column(Boolean, default=False, nullable=False)
    spotlighted = Column(Boolean, default=False, nullable=False)

    @property
    def is_community_winner(self):
        return "[Free Skip Winner]" in (self.notes or "")

    # Gamification Fields
    review_score = Column(Numeric(4, 2), nullable=True) # Re-mapping float score to precision decimal
    poll_result_w_percent = Column(Integer, nullable=True)
    average_concurrent_viewers = Column(Integer, nullable=True)

    # New fields for submission details
    start_time = Column(String, nullable=True) # e.g. "0:45"
    end_time = Column(String, nullable=True)   # e.g. "2:30"
    genre = Column(String, nullable=True)
    tags = Column(JsonEncodedList, nullable=True)

    # New fields for Smart-Zone and Double Feature
    batch_id = Column(String, nullable=True, index=True) # UUID string to link submissions
    sequence_order = Column(Integer, default=1, nullable=False) # 1 or 2
    hook_start_time = Column(Integer, nullable=True) # Seconds
    hook_end_time = Column(Integer, nullable=True) # Seconds
    file_hash = Column(String, nullable=True, index=True) # SHA256 hash of the file

    reviewer = relationship("Reviewer", back_populates="submissions")
    user = relationship("User", back_populates="submissions")
    session = relationship("ReviewSession", back_populates="submissions")

    __table_args__ = (Index("ix_submission_reviewer_id_status", "reviewer_id", "status"),)


class EconomyConfig(Base):
    __tablename__ = "economy_configs"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    event_name = Column(String, nullable=False)
    coin_amount = Column(Integer, nullable=False)

    reviewer = relationship("Reviewer", back_populates="economy_configs")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    meta_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    reviewer = relationship("Reviewer", back_populates="transactions")
    user = relationship("User", back_populates="transactions")


class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    balance = Column(Integer, default=0, nullable=False)

    user = relationship("User")
    reviewer = relationship("Reviewer")


class DiscordUserCache(Base):
    __tablename__ = "discord_user_cache"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)


class ReviewSession(Base):
    __tablename__ = "review_sessions"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC))
    open_queue_tiers = Column(JSON, default=[0, 5, 10, 15, 20, 25, 50], nullable=False)

    reviewer = relationship("Reviewer")
    submissions = relationship("Submission", back_populates="session")


class TikTokAccount(Base):
    __tablename__ = "tiktok_accounts"
    id = Column(Integer, primary_key=True, index=True)
    handle_name = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    points = Column(Integer, default=0, nullable=False)
    monitored = Column(Boolean, default=False, nullable=False)

    user = relationship("User")


class TikTokInteraction(Base):
    __tablename__ = "tiktok_interactions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=True)
    tiktok_account_id = Column(Integer, ForeignKey("tiktok_accounts.id"), nullable=True)
    host_handle = Column(String, nullable=False)
    interaction_type = Column(String, nullable=False)
    value = Column(String, nullable=True)
    coin_value = Column(Integer, default=0)
    user_level = Column(Integer, default=0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReviewSession")
    tiktok_account = relationship("TikTokAccount")


class TikTokRankUpdate(Base):
    __tablename__ = "tiktok_rank_updates"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("review_sessions.id"), nullable=True)
    tiktok_user_id = Column(Integer, nullable=False) # TikTok's internal user ID
    rank = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    delta = Column(Integer, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


# New Gamification Tables

class LiveSession(Base):
    __tablename__ = "live_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    tiktok_room_id = Column(String, nullable=True)
    max_concurrent_viewers = Column(Integer, default=0)
    total_likes = Column(BigInteger, default=0)
    total_diamonds = Column(BigInteger, default=0)
    status = Column(String, default="LIVE")
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="live_sessions")


class AchievementDefinition(Base):
    __tablename__ = "achievement_definitions"
    id = Column(String, primary_key=True) # UUID
    slug = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=False) # 'LIFETIME_LIKES', 'SUBMISSION_COUNT', etc.
    threshold_value = Column(BigInteger, nullable=False)
    tier = Column(Integer, default=1, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    discord_role_id = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    role_color = Column(String, nullable=True)
    role_icon = Column(String, nullable=True)

    user_achievements = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id = Column(String, primary_key=True) # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    achievement_id = Column(String, ForeignKey("achievement_definitions.id"), nullable=True)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())
    discord_sync_status = Column(String, default="PENDING")

    user = relationship("User", back_populates="achievements")
    achievement = relationship("AchievementDefinition", back_populates="user_achievements")




class GlobalConfig(Base):
    __tablename__ = "global_configs"
    key = Column(String, primary_key=True, index=True)
    value = Column(JSON, nullable=True)

