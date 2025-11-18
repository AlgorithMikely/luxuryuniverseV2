from sqlalchemy.orm import Session, joinedload
import models
import schemas
from typing import Optional
import event_service

async def create_submission(db: Session, reviewer_id: int, user_id: int, track_url: str, track_title: str, archived_url: str, session_id: Optional[int] = None) -> models.Submission:
    # ... logic to find or create user ...
    new_submission = models.Submission(
        reviewer_id=reviewer_id,
        user_id=user_id,
        track_url=track_url,
        track_title=track_title,
        archived_url=archived_url,
        status='pending',
        session_id=session_id
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

def get_pending_queue(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(joinedload(models.Submission.user)).filter(
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
        # Convert SQLAlchemy models to Pydantic models for serialization
        queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
        await event_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])

        # Also emit a history update
        new_history = get_played_queue(db, reviewer_id)
        history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
        await event_service.emit_history_update(reviewer_id, [s.model_dump() for s in history_schemas])


    return submission

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

def get_bookmarked_submissions(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(joinedload(models.Submission.user)).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.bookmarked == True
    ).order_by(models.Submission.submitted_at.desc()).all()

def get_spotlighted_submissions(db: Session, reviewer_id: int) -> list[models.Submission]:
    return db.query(models.Submission).options(joinedload(models.Submission.user)).filter(
        models.Submission.reviewer_id == reviewer_id,
        models.Submission.spotlighted == True
    ).order_by(models.Submission.submitted_at.desc()).all()

def get_initial_state(db: Session, reviewer_id: int) -> schemas.FullQueueState:
    queue = get_pending_queue(db, reviewer_id)
    history = get_played_queue(db, reviewer_id)
    bookmarks = get_bookmarked_submissions(db, reviewer_id)
    spotlight = get_spotlighted_submissions(db, reviewer_id)

    return schemas.FullQueueState(
        queue=[schemas.Submission.model_validate(s) for s in queue],
        history=[schemas.Submission.model_validate(s) for s in history],
        bookmarks=[schemas.Submission.model_validate(s) for s in bookmarks],
        spotlight=[schemas.Submission.model_validate(s) for s in spotlight],
    )

async def review_submission(db: Session, submission_id: int, review: schemas.ReviewCreate) -> models.Submission:
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.score = review.score
    submission.notes = review.notes
    submission.status = 'reviewed'
    db.commit()
    db.refresh(submission)

    # Emit a history update
    new_history = get_played_queue(db, submission.reviewer_id)
    history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
    await event_service.emit_history_update(submission.reviewer_id, [s.model_dump() for s in history_schemas])

    return submission

def create_session(db: Session, reviewer_id: int, name: str) -> models.ReviewSession:
    # Set all other sessions for this reviewer to inactive
    db.query(models.ReviewSession).filter(models.ReviewSession.reviewer_id == reviewer_id).update({models.ReviewSession.is_active: False})

    new_session = models.ReviewSession(
        reviewer_id=reviewer_id,
        name=name,
        is_active=True
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

def get_sessions_by_reviewer(db: Session, reviewer_id: int) -> list[models.ReviewSession]:
    return db.query(models.ReviewSession).filter(models.ReviewSession.reviewer_id == reviewer_id).all()

def get_active_session_by_reviewer(db: Session, reviewer_id: int) -> Optional[models.ReviewSession]:
    return db.query(models.ReviewSession).filter(
        models.ReviewSession.reviewer_id == reviewer_id,
        models.ReviewSession.is_active == True
    ).first()

def activate_session(db: Session, reviewer_id: int, session_id: int) -> models.ReviewSession:
    db.query(models.ReviewSession).filter(models.ReviewSession.reviewer_id == reviewer_id).update({models.ReviewSession.is_active: False})
    session = db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = True
    db.commit()
    db.refresh(session)
    return session

def archive_session(db: Session, reviewer_id: int, session_id: int) -> models.ReviewSession:
    session = db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    db.commit()
    db.refresh(session)
    return session

def update_session(db: Session, reviewer_id: int, session_id: int, session_update: schemas.ReviewSessionUpdate) -> models.ReviewSession:
    session = db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.name = session_update.name
    db.commit()
    db.refresh(session)
    return session

def get_session_by_id(db: Session, session_id: int) -> Optional[models.ReviewSession]:
    return db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id).first()

def get_submissions_by_session(db: Session, session_id: int) -> list[models.Submission]:
    return db.query(models.Submission).filter(models.Submission.session_id == session_id).all()
