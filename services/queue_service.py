from sqlalchemy.orm import Session
from sqlalchemy import or_
import models
import schemas
from typing import Optional
import event_service
import datetime
import asyncio

def create_submission(db: Session, reviewer_id: int, user_id: int, track_url: str, artist: str = None, title: str = None) -> models.Submission:
    # Check if a submission with the same track_url exists
    existing_submission = db.query(models.Submission).filter(models.Submission.track_url == track_url).first()

    if existing_submission:
        # If it exists, increment the submission_count and add a new reviewer association
        existing_submission.submission_count += 1
        new_submission_reviewer = models.SubmissionReviewer(
            submission_id=existing_submission.id,
            reviewer_id=reviewer_id
        )
        db.add(new_submission_reviewer)
        db.commit()
        db.refresh(existing_submission)
        new_submission = existing_submission
    else:
        # If it doesn't exist, create a new submission
        new_submission = models.Submission(
            reviewer_id=reviewer_id,
            user_id=user_id,
            track_url=track_url,
            status='queued',
            artist=artist,
            title=title
        )
        db.add(new_submission)
        db.commit()
        db.refresh(new_submission)

        # Add the first reviewer association
        new_submission_reviewer = models.SubmissionReviewer(
            submission_id=new_submission.id,
            reviewer_id=reviewer_id
        )
        db.add(new_submission_reviewer)
        db.commit()

    return new_submission

def get_pending_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    """
    Retrieves all submissions that are currently in the queue for a specific
    reviewer. This includes both 'queued' (free) and 'pending' (priority)
    submissions.
    """
    return db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        or_(
            models.Submission.status == 'queued',
            models.Submission.status == 'pending'
        )
    ).order_by(models.Submission.submitted_at.asc()).all()

def get_played_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'played'
    ).order_by(models.Submission.played_at.desc()).all()

async def spotlight_submission(db: Session, reviewer_id: int, submission_id: int, spotlight: bool) -> Optional[models.Submission]:
    submission = db.query(models.Submission).filter(
        models.Submission.id == submission_id,
        models.Submission.reviewer_id == reviewer_id
    ).first()

    if submission:
        submission.is_spotlighted = spotlight
        db.commit()
        db.refresh(submission)

        new_queue_models = get_pending_queue(db, reviewer_id)
        new_queue_schemas = [schemas.SubmissionDetail.from_orm(s) for s in new_queue_models]
        await event_service.emit_queue_update(reviewer_id, [s.dict() for s in new_queue_schemas])

    return submission

async def bookmark_submission(db: Session, reviewer_id: int, submission_id: int, bookmark: bool) -> Optional[models.Submission]:
    submission = db.query(models.Submission).filter(
        models.Submission.id == submission_id,
        models.Submission.reviewer_id == reviewer_id
    ).first()

    if submission:
        submission.is_bookmarked = bookmark
        db.commit()
        db.refresh(submission)

        new_queue_models = get_pending_queue(db, reviewer_id)
        new_queue_schemas = [schemas.SubmissionDetail.from_orm(s) for s in new_queue_models]
        await event_service.emit_queue_update(reviewer_id, [s.dict() for s in new_queue_schemas])

    return submission

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
        or_(
            models.Submission.status == 'queued',
            models.Submission.status == 'pending'
        )
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        submission.played_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(submission)

        new_queue_models = get_pending_queue(db, reviewer_id)
        new_queue_schemas = [schemas.SubmissionDetail.from_orm(s) for s in new_queue_models]
        await event_service.emit_queue_update(reviewer_id, [s.dict() for s in new_queue_schemas])

    return submission

def get_reviewer_by_user_id(db: Session, user_id: int) -> Optional[models.Reviewer]:
    return db.query(models.Reviewer).filter(models.Reviewer.user_id == user_id).first()

def get_reviewer_by_channel_id(db: Session, channel_id: str) -> Optional[models.Reviewer]:
    channel_id_str = str(channel_id)
    return db.query(models.Reviewer).filter(
        (models.Reviewer.submission_channel_id == channel_id_str) |
        (models.Reviewer.queue_channel_id == channel_id_str)
    ).first()

from sqlalchemy.orm import joinedload

def get_submissions_by_user(db: Session, user_id: int) -> list[models.Submission]:
    """
    Retrieves all submissions by a specific user, along with the reviewers
    for each submission.
    """
    return (
        db.query(models.Submission)
        .filter(models.Submission.user_id == user_id)
        .options(
            joinedload(models.Submission.reviewers)
            .joinedload(models.SubmissionReviewer.reviewer)
            .joinedload(models.Reviewer.user)
        )
        .order_by(models.Submission.submitted_at.desc())
        .all()
    )

def advance_queue_and_get_user(db: Session, reviewer_id: int) -> Optional[tuple[models.Submission, str]]:
    submission = db.query(models.Submission).filter(
        models.Submission.reviewer_id == reviewer_id,
        or_(
            models.Submission.status == 'queued',
            models.Submission.status == 'pending'
        )
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        submission.played_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(submission)

        new_queue_models = get_pending_queue(db, reviewer_id)
        new_queue_schemas = [schemas.SubmissionDetail.from_orm(s) for s in new_queue_models]

        async def emit_event():
            await event_service.emit_queue_update(reviewer_id, [s.dict() for s in new_queue_schemas])

        import threading
        threading.Thread(target=lambda: asyncio.run(emit_event())).start()

        return submission, submission.user.discord_id
    return None

def get_pending_queue_with_users(db: Session, reviewer_id: int) -> list[tuple[models.Submission, str]]:
    return db.query(models.Submission, models.User.discord_id).join(models.User).filter(
        models.Submission.reviewer_id == reviewer_id,
        or_(
            models.Submission.status == 'queued',
            models.Submission.status == 'pending'
        )
    ).order_by(models.Submission.submitted_at.asc()).all()
