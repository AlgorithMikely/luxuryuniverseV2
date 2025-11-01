from sqlalchemy.orm import Session, joinedload
import models
from typing import Optional
import event_service
import datetime
import asyncio
import schemas

def create_submission(db: Session, reviewer_id: int, user_id: int, track_url: str, track_artist: str = None, track_title: str = None) -> models.Submission:
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
            status='pending',
            track_artist=track_artist,
            track_title=track_title
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

    # Eagerly load the user relationship to ensure it's available for socket events
    db.refresh(new_submission)
    return db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(models.Submission.id == new_submission.id).one()

def get_pending_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status.in_(['pending', 'playing'])
    ).order_by(models.Submission.submitted_at.asc()).all()

def get_played_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
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

        new_queue = get_pending_queue(db, reviewer_id)
        queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, queue_data)

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

        new_queue = get_pending_queue(db, reviewer_id)
        queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, queue_data)

    return submission

async def update_submission_review(db: Session, reviewer_id: int, submission_id: int, review_data: schemas.ReviewCreate) -> Optional[models.Submission]:
    submission = db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
        models.Submission.id == submission_id,
        models.Submission.reviewer_id == reviewer_id
    ).first()

    if submission:
        submission.rating = review_data.rating
        submission.status = review_data.status
        submission.tags = review_data.tags
        submission.private_notes = review_data.private_notes
        submission.public_review = review_data.public_review
        db.commit()
        db.refresh(submission)

        # Emit queue update after review is submitted
        new_queue = get_pending_queue(db, reviewer_id)
        queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, queue_data)

    return submission

def set_queue_status(db: Session, reviewer_id: int, status: str):
    reviewer = db.query(models.Reviewer).filter(models.Reviewer.id == reviewer_id).first()
    if reviewer:
        reviewer.queue_status = status
        db.commit()
        db.refresh(reviewer)
    return reviewer

async def advance_queue(db: Session, reviewer_id: int) -> Optional[models.Submission]:
    submission = db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        submission.played_at = datetime.datetime.now(datetime.UTC)
        db.commit()
        db.refresh(submission)

        # Emit a queue update
        new_queue = get_pending_queue(db, reviewer_id)
        queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, queue_data)

    return submission

async def set_next_track_playing(db: Session, reviewer_id: int) -> Optional[models.Submission]:
    """Finds the next pending submission and sets its status to 'playing'."""
    next_submission = db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).first()

    if next_submission:
        next_submission.status = 'playing'
        db.commit()
        db.refresh(next_submission)

        # Emit a queue update to reflect the new 'playing' track
        new_queue = get_pending_queue(db, reviewer_id)
        queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, queue_data)

    return next_submission

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
    submission = db.query(models.Submission).options(
        joinedload(models.Submission.user)
    ).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).first()

    if submission:
        submission.status = 'played'
        submission.played_at = datetime.datetime.now(datetime.UTC)
        db.commit()
        db.refresh(submission)

        # Emit a queue update
        new_queue = get_pending_queue(db, reviewer_id)

        async def emit_event():
            queue_data = [schemas.Submission.model_validate(s).model_dump() for s in new_queue]
            await event_service.emit_queue_update(reviewer_id, queue_data)

        # Run the async function in a separate thread to avoid blocking
        import threading
        threading.Thread(target=lambda: asyncio.run(emit_event())).start()

        return submission, submission.user.discord_id
    return None

def get_pending_queue_with_users(db: Session, reviewer_id: int) -> list[tuple[models.Submission, str]]:
    return db.query(models.Submission, models.User.discord_id).join(models.User).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'pending'
    ).order_by(models.Submission.submitted_at.asc()).all()
