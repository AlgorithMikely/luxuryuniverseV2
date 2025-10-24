from sqlalchemy.orm import Session
from typing import Optional
import models
from config import settings

class OwnerContextError(Exception):
    """Custom exception for owner actions outside a reviewer channel context."""
    pass


def get_authorized_reviewer(db: Session, user_discord_id: str, channel_id: str) -> Optional[models.Reviewer]:
    """
    Checks if a user is authorized for a channel (owner, reviewer, or moderator)
    and returns the associated reviewer profile.
    """
    from services import queue_service  # Local import to avoid circular dependency

    user = get_user_by_discord_id(db, user_discord_id)
    if not user:
        return None

    is_admin = str(user.discord_id) in settings.ADMIN_DISCORD_IDS

    reviewer = queue_service.get_reviewer_by_channel_id(db, channel_id)

    if is_admin:
        if not reviewer:
            raise OwnerContextError("Admin commands must be run in a reviewer's channel.")
        return reviewer

    if not reviewer:
        return None

    # Check if the user is the reviewer of this channel
    if reviewer.user_id == user.id:
        return reviewer

    # Check if the user is a moderator for this reviewer
    is_moderator = db.query(models.Moderator).filter(
        models.Moderator.reviewer_id == reviewer.id,
        models.Moderator.user_id == user.id
    ).first()

    if is_moderator:
        return reviewer

    return None

def get_user_by_discord_id(db: Session, discord_id: str) -> models.User | None:
    """Retrieves a user by their Discord ID."""
    return db.query(models.User).filter(models.User.discord_id == discord_id).first()

def get_or_create_user(db: Session, discord_id: str, username: str) -> models.User:
    """
    Retrieves a user by their Discord ID, or creates a new one if they don't exist.
    """
    user = get_user_by_discord_id(db, discord_id)
    if user:
        # Update username if it has changed
        if user.username != username:
            user.username = username
            db.commit()
            db.refresh(user)
        return user

    new_user = models.User(discord_id=discord_id, username=username)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def get_user_by_username(db: Session, username: str) -> models.User | None:
    """Retrieves a user by their username."""
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_tiktok_username(db: Session, tiktok_username: str) -> models.User | None:
    """Retrieve a user by their TikTok username."""
    return db.query(models.User).filter(models.User.tiktok_username == tiktok_username).first()

def get_user_with_reviewer_profile(db: Session, discord_id: str) -> models.User | None:
    """Retrieves a user and their reviewer profile, if it exists."""
    return db.query(models.User).filter(models.User.discord_id == discord_id).first()

def get_reviewer_by_user_id(db: Session, user_id: int) -> Optional[models.Reviewer]:
    """Retrieves a reviewer profile by user ID."""
    return db.query(models.Reviewer).filter(models.Reviewer.user_id == user_id).first()

def create_reviewer(db: Session, user_id: int, submission_channel_id: str, queue_channel_id: str, reviewer_role_id: str) -> Optional[models.Reviewer]:
    """Creates a new reviewer profile for a user."""
    existing_reviewer = get_reviewer_by_user_id(db, user_id)
    if existing_reviewer:
        return None  # User is already a reviewer

    new_reviewer = models.Reviewer(
        user_id=user_id,
        submission_channel_id=submission_channel_id,
        queue_channel_id=queue_channel_id,
        reviewer_role_id=reviewer_role_id
    )
    db.add(new_reviewer)
    db.commit()
    db.refresh(new_reviewer)
    return new_reviewer

def add_moderator(db: Session, reviewer_id: int, moderator_user_id: int) -> bool:
    """Adds a user as a moderator for a reviewer."""
    existing_moderator = db.query(models.Moderator).filter(
        models.Moderator.reviewer_id == reviewer_id,
        models.Moderator.user_id == moderator_user_id
    ).first()

    if existing_moderator:
        return False  # User is already a moderator

    new_moderator = models.Moderator(reviewer_id=reviewer_id, user_id=moderator_user_id)
    db.add(new_moderator)
    db.commit()
    return True

def remove_moderator(db: Session, reviewer_id: int, moderator_user_id: int) -> bool:
    """Removes a user as a moderator for a reviewer."""
    moderator = db.query(models.Moderator).filter(
        models.Moderator.reviewer_id == reviewer_id,
        models.Moderator.user_id == moderator_user_id
    ).first()

    if not moderator:
        return False  # User is not a moderator

    db.delete(moderator)
    db.commit()
    return True
