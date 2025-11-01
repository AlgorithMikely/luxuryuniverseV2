from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Index,
    Boolean,
)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    tiktok_username = Column(String, unique=True, nullable=True)

    reviewer_profile = relationship("Reviewer", back_populates="user", uselist=False)
    submissions = relationship("Submission", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    moderated_reviewers = relationship("Moderator", back_populates="user")


class Reviewer(Base):
    __tablename__ = "reviewers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tiktok_handle = Column(String, unique=True)
    submission_channel_id = Column(String, unique=True, nullable=False)
    queue_channel_id = Column(String, unique=True, nullable=False)
    files_and_links_channel_id = Column(String, unique=True, nullable=True)
    reviewer_role_id = Column(String, unique=True, nullable=False)
    queue_status = Column(String, default="closed", nullable=False)

    user = relationship("User", back_populates="reviewer_profile")
    submissions = relationship("Submission", back_populates="reviewer")
    economy_configs = relationship("EconomyConfig", back_populates="reviewer")
    transactions = relationship("Transaction", back_populates="reviewer")
    moderators = relationship("Moderator", back_populates="reviewer")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    track_url = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, playing, played
    submitted_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))
    played_at = Column(DateTime, nullable=True)
    is_spotlighted = Column(Boolean, default=False, nullable=False)
    is_bookmarked = Column(Boolean, default=False, nullable=False)

    reviewer = relationship("Reviewer", back_populates="submissions")
    user = relationship("User", back_populates="submissions", lazy="joined")

    __table_args__ = (Index("ix_submission_reviewer_id_status", "reviewer_id", "status"),)

    track_artist = Column(String, nullable=True)
    track_title = Column(String, nullable=True)
    submission_count = Column(Integer, default=1, nullable=False)

    # Review fields
    rating = Column(Integer, nullable=True)
    tags = Column(String, nullable=True)
    private_notes = Column(String, nullable=True)
    public_review = Column(String, nullable=True)

    reviewers = relationship("SubmissionReviewer", back_populates="submission")


class SubmissionReviewer(Base):
    __tablename__ = "submission_reviewers"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)

    submission = relationship("Submission", back_populates="reviewers")
    reviewer = relationship("Reviewer")


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
    timestamp = Column(DateTime, server_default=func.now())

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


class Moderator(Base):
    __tablename__ = "moderators"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)

    user = relationship("User", back_populates="moderated_reviewers")
    reviewer = relationship("Reviewer", back_populates="moderators")
