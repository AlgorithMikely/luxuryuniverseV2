from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
import models
import schemas
from typing import Optional
import event_service

def get_active_session(db: Session, reviewer_id: int) -> Optional[models.ReviewSession]:
    """
    Retrieves the active review session for a given reviewer.
    """
    return db.query(models.ReviewSession).filter_by(reviewer_id=reviewer_id, status='active').first()

async def create_submission(db: Session, reviewer_id: int, user_id: int, track_url: str, track_title: str, archived_url: str) -> models.Submission:
    # Find active session for the reviewer
    active_session = get_active_session(db, reviewer_id)
    if not active_session:
        # If no active session, create a new one
        active_session = models.ReviewSession(reviewer_id=reviewer_id, name="New Session", status='active')
        db.add(active_session)
        db.commit()
        db.refresh(active_session)

    new_submission = models.Submission(
        reviewer_id=reviewer_id,
        user_id=user_id,
        session_id=active_session.id,
        track_url=track_url,
        track_title=track_title,
        archived_url=archived_url,
        status='pending'
    )
    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    # Emit a queue update
    new_queue = get_pending_queue(db, reviewer_id)
    # Convert SQLAlchemy models to Pydantic models for serialization
    queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
    await event_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])

    return new_submission

def get_sorted_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    """
    Gets the sorted and filtered queue for a reviewer based on their active session.
    """
    active_session = get_active_session(db, reviewer_id)
    if not active_session:
        return []

    return db.query(models.Submission).options(joinedload(models.Submission.user)).filter(
        and_(
            models.Submission.session_id == active_session.id,
            models.Submission.skipValue.in_(active_session.open_queue_tiers)
        )
    ).order_by(models.Submission.skipValue.desc()).all()

def get_pending_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return get_sorted_queue(db, reviewer_id)

def create_session(db: Session, reviewer_id: int) -> models.ReviewSession:
    """
    Creates a new, active review session for a reviewer.
    """
    new_session = models.ReviewSession(
        reviewer_id=reviewer_id,
        name="New Session",
        status='active',
        open_queue_tiers=[0, 5, 10, 15, 20, 25]  # Default tiers
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

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
        # Convert SQLAlchemy models to Pydantic models for serialization
        queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])


    return submission

def get_reviewer_by_channel_id(db: Session, channel_id: str) -> Optional[models.Reviewer]:
    return db.query(models.Reviewer).filter(models.Reviewer.discord_channel_id == channel_id).first()

def get_reviewer_by_user_id(db: Session, user_id: int) -> Optional[models.Reviewer]:
    return db.query(models.Reviewer).filter(models.Reviewer.user_id == user_id).first()

def get_reviewer_by_channel_id(db: Session, channel_id: str) -> Optional[models.Reviewer]:
    return db.query(models.Reviewer).filter(models.Reviewer.discord_channel_id == str(channel_id)).first()

def get_submissions_by_user(db: Session, user_id: int) -> list[models.Submission]:
    return db.query(models.Submission).filter(models.Submission.user_id == user_id).all()

def get_played_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(joinedload(models.Submission.user)).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.status == 'played'
    ).order_by(models.Submission.submitted_at.desc()).all()

def review_submission(db: Session, submission_id: int, review: schemas.ReviewCreate) -> models.Submission:
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.score = review.score
    submission.notes = review.notes
    submission.status = 'reviewed'
    db.commit()
    db.refresh(submission)
    return submission
