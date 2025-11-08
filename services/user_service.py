from sqlalchemy.orm import Session, joinedload
import models

def get_user_by_discord_id(db: Session, discord_id: str) -> models.User | None:
    """Retrieves a user by their Discord ID."""
    return (
        db.query(models.User)
        .options(joinedload(models.User.reviewer_profile))
        .filter(models.User.discord_id == discord_id)
        .first()
    )

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

def get_all_reviewers(db: Session) -> list[models.User]:
    """Retrieves all users with a reviewer profile."""
    return db.query(models.User).join(models.Reviewer).all()

def add_reviewer_profile(
    db: Session, user: models.User, tiktok_handle: str | None = None
) -> models.User:
    """Adds a reviewer profile to a user."""
    if user.reviewer_profile:
        # Update existing profile if tiktok_handle is provided
        if tiktok_handle:
            user.reviewer_profile.tiktok_handle = tiktok_handle
            db.commit()
            db.refresh(user)
        return user

    # Create new profile
    new_reviewer_profile = models.Reviewer(
        user_id=user.id, tiktok_handle=tiktok_handle
    )
    db.add(new_reviewer_profile)
    db.commit()
    db.refresh(user)
    return user

def remove_reviewer_profile(db: Session, reviewer_id: int) -> bool:
    """Removes a reviewer profile from a user."""
    reviewer_profile = db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()
    if not reviewer_profile:
        return False

    db.delete(reviewer_profile)
    db.commit()
    return True

def get_all_discord_users(db: Session) -> list[models.DiscordUserCache]:
    """Retrieves all users from the Discord user cache."""
    return db.query(models.DiscordUserCache).all()
