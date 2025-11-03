from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Index,
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
    tiktok_username = Column(String, unique=True, nullable=True)

    reviewer_profile = relationship("Reviewer", back_populates="user", uselist=False)
    submissions = relationship("Submission", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")


class Reviewer(Base):
    __tablename__ = "reviewers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tiktok_handle = Column(String, unique=True)
    discord_channel_id = Column(String, unique=True, nullable=True)
    queue_status = Column(String, default="closed", nullable=False)

    user = relationship("User", back_populates="reviewer_profile")
    submissions = relationship("Submission", back_populates="reviewer")
    economy_configs = relationship("EconomyConfig", back_populates="reviewer")
    transactions = relationship("Transaction", back_populates="reviewer")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    track_url = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    reviewer = relationship("Reviewer", back_populates="submissions")
    user = relationship("User", back_populates="submissions")

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


class DiscordUserCache(Base):
    __tablename__ = "discord_user_cache"
    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
