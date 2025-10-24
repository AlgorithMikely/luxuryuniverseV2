from sqlalchemy.orm import Session
import models
from typing import Optional
import event_service

async def create_submission(db: Session, reviewer_id: int, user_id: int, track_url: str) -> models.Submission:
    # ... logic to find or create user ...
    new_submission = models.Submission(
        reviewer_id=reviewer_id,
        user_id=user_id,
        track_url=track_url,
        status='pending'
    )
    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    # Emit a queue update
    new_queue = get_pending_queue(db, reviewer_id)
    await event_service.emit_queue_update(reviewer_id, [s.__dict__ for s in new_queue])

    return new_submission

def get_pending_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).all()

def set_queue_status(db: Session, reviewer_id: int, status: str):
    reviewer = db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()
    if reviewer:
        reviewer.queue_status = status
        db.commit()
        db.refresh(reviewer)
    return reviewer

async def advance_queue(db: Session, reviewer_id: int) -> Optional[models.Submission]:
    submission = db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        db.commit()
        db.refresh(submission)

        # Emit a queue update
        new_queue = get_pending_queue(db, reviewer_id)
        await event_service.emit_queue_update(reviewer_id, [s.__dict__ for s in new_queue])

    return submission

def get_reviewer_by_user_id(db: Session, user_id: int) -> Optional[models.Reviewer]:
    return db.query(models.Reviewer).filter(models.Reviewer.user_id == user_id).first()

def get_reviewer_by_channel_id(db: Session, channel_id: str) -> Optional[models.Reviewer]:
    channel_id_str = str(channel_id)
    return db.query(models.Reviewer).filter(
        (models.Reviewer.submission_channel_id == channel_id_str) |
        (models.Reviewer.queue_channel_id == channel_id_str)
    ).first()

def get_submissions_by_user(db: Session, user_id: int) -> list[models.Submission]:
    return db.query(models.Submission).filter(models.Submission.user_id == user_id).all()

def advance_queue_and_get_user(db: Session, reviewer_id: int) -> Optional[tuple[models.Submission, str]]:
    submission = db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        db.commit()
        db.refresh(submission)
        return submission, submission.user.discord_id
    return None

def get_pending_queue_with_users(db: Session, reviewer_id: int) -> list[tuple[models.Submission, str]]:
    return db.query(models.Submission, models.User.discord_id).join(models.User).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).all()
