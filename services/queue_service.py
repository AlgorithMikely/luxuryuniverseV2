from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload, selectinload
import models
import schemas
from typing import Optional
from services import broadcast as broadcast_service
import datetime

async def create_submission(db: AsyncSession, reviewer_id: int, user_id: int, track_url: str, track_title: str, archived_url: str, session_id: Optional[int] = None) -> models.Submission:
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
    await db.commit()

    # FIXED: Re-fetch the submission to eager-load the 'user' relationship for the API response
    stmt = select(models.Submission).options(joinedload(models.Submission.user)).filter(models.Submission.id == new_submission.id)
    result = await db.execute(stmt)
    loaded_submission = result.scalars().first()

    # Emit a queue update
    new_queue = await get_pending_queue(db, reviewer_id)
    queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
    await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])

    return loaded_submission

async def get_pending_queue(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'pending'
        )
        .order_by(models.Submission.is_priority.desc(), models.Submission.submitted_at.asc())
    )
    return result.scalars().all()

async def set_queue_status(db: AsyncSession, reviewer_id: int, status: str):
    result = await db.execute(select(models.Reviewer).filter(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()
    if reviewer:
        reviewer.queue_status = status
        await db.commit()
        await db.refresh(reviewer)
    return reviewer

async def advance_queue(db: AsyncSession, reviewer_id: int) -> Optional[models.Submission]:
    # Get the next submission
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user)) # FIXED: Load user
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'pending'
        )
        .order_by(models.Submission.is_priority.desc(), models.Submission.submitted_at.asc())
        .limit(1)
    )
    submission = result.scalars().first()

    if submission:
        submission.status = 'played'
        await db.commit()
        # No refresh needed here as we already have the object and just changed a scalar field

        # Emit a queue update
        new_queue = await get_pending_queue(db, reviewer_id)
        queue_schemas = [schemas.Submission.model_validate(s) for s in new_queue]
        await broadcast_service.emit_queue_update(reviewer_id, [s.model_dump() for s in queue_schemas])

        # Also emit a history update
        new_history = await get_played_queue(db, reviewer_id)
        history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
        await broadcast_service.emit_history_update(reviewer_id, [s.model_dump() for s in history_schemas])

    return submission

async def get_reviewer_by_user_id(db: AsyncSession, user_id: int) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(joinedload(models.Reviewer.user))
        .filter(models.Reviewer.user_id == user_id)
    )
    return result.scalars().first()

async def get_reviewer_by_channel_id(db: AsyncSession, channel_id: str) -> Optional[models.Reviewer]:
    result = await db.execute(
        select(models.Reviewer)
        .options(joinedload(models.Reviewer.user))
        .filter(models.Reviewer.discord_channel_id == str(channel_id))
    )
    return result.scalars().first()

async def get_submissions_by_user(db: AsyncSession, user_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user)) # FIXED: Load user
        .filter(models.Submission.user_id == user_id)
    )
    return result.scalars().all()

async def get_played_queue(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(
            models.Submission.reviewer_id == reviewer_id,
            models.Submission.status == 'played'
        )
        .order_by(models.Submission.submitted_at.desc())
    )
    return result.scalars().all()

async def get_bookmarked_submissions(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    try:
        result = await db.execute(
            select(models.Submission)
            .options(joinedload(models.Submission.user))
            .filter(
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.bookmarked == True
            )
            .order_by(models.Submission.submitted_at.desc())
        )
        return result.scalars().all()
    except Exception:
        return []

async def get_spotlighted_submissions(db: AsyncSession, reviewer_id: int) -> list[models.Submission]:
    try:
        result = await db.execute(
            select(models.Submission)
            .options(joinedload(models.Submission.user))
            .filter(
                models.Submission.reviewer_id == reviewer_id,
                models.Submission.spotlighted == True
            )
            .order_by(models.Submission.submitted_at.desc())
        )
        return result.scalars().all()
    except Exception:
        return []

async def get_initial_state(db: AsyncSession, reviewer_id: int) -> schemas.FullQueueState:
    queue = await get_pending_queue(db, reviewer_id)
    history = await get_played_queue(db, reviewer_id)
    bookmarks = await get_bookmarked_submissions(db, reviewer_id)
    spotlight = await get_spotlighted_submissions(db, reviewer_id)

    return schemas.FullQueueState(
        queue=[schemas.Submission.model_validate(s) for s in queue],
        history=[schemas.Submission.model_validate(s) for s in history],
        bookmarks=[schemas.Submission.model_validate(s) for s in bookmarks],
        spotlight=[schemas.Submission.model_validate(s) for s in spotlight],
    )

async def review_submission(db: AsyncSession, submission_id: int, review: schemas.ReviewCreate) -> models.Submission:
    # FIXED: Load user
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()
    if not submission:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.score = review.score
    submission.notes = review.notes
    submission.status = 'reviewed'
    await db.commit()
    # Don't refresh, we have the object and updated it. Refreshing might strip relations if not careful.

    # Emit a history update
    new_history = await get_played_queue(db, submission.reviewer_id)
    history_schemas = [schemas.Submission.model_validate(s) for s in new_history]
    await broadcast_service.emit_history_update(submission.reviewer_id, [s.model_dump() for s in history_schemas])

    return submission

async def create_session(db: AsyncSession, reviewer_id: int, name: str) -> models.ReviewSession:
    await db.execute(
        update(models.ReviewSession)
        .where(models.ReviewSession.reviewer_id == reviewer_id)
        .values(is_active=False)
    )

    new_session = models.ReviewSession(
        reviewer_id=reviewer_id,
        name=name,
        is_active=True
    )
    db.add(new_session)
    await db.commit()

    # FIXED: Nested loading of submissions and their users
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == new_session.id)
    )
    return result.scalars().first()

async def get_sessions_by_reviewer(db: AsyncSession, reviewer_id: int) -> list[models.ReviewSession]:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.reviewer_id == reviewer_id)
    )
    return result.scalars().all()

async def get_active_session_by_reviewer(db: AsyncSession, reviewer_id: int) -> Optional[models.ReviewSession]:
    # FIXED: Nested loading of submissions.user so Pydantic can serialize it
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(
            models.ReviewSession.reviewer_id == reviewer_id,
            models.ReviewSession.is_active == True
        )
    )
    return result.scalars().first()

async def activate_session(db: AsyncSession, reviewer_id: int, session_id: int) -> models.ReviewSession:
    await db.execute(
        update(models.ReviewSession)
        .where(models.ReviewSession.reviewer_id == reviewer_id)
        .values(is_active=False)
    )

    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = True
    await db.commit()
    return session

async def archive_session(db: AsyncSession, reviewer_id: int, session_id: int) -> models.ReviewSession:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    await db.commit()
    return session

async def update_session(db: AsyncSession, reviewer_id: int, session_id: int, session_update: schemas.ReviewSessionUpdate) -> models.ReviewSession:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id, models.ReviewSession.reviewer_id == reviewer_id)
    )
    session = result.scalars().first()

    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    session.name = session_update.name
    await db.commit()
    return session

async def get_session_by_id(db: AsyncSession, session_id: int) -> Optional[models.ReviewSession]:
    # FIXED: Nested loading
    result = await db.execute(
        select(models.ReviewSession)
        .options(selectinload(models.ReviewSession.submissions).joinedload(models.Submission.user))
        .filter(models.ReviewSession.id == session_id)
    )
    return result.scalars().first()

async def get_submissions_by_session(db: AsyncSession, session_id: int) -> list[models.Submission]:
    # FIXED: Load user
    result = await db.execute(
        select(models.Submission)
        .options(joinedload(models.Submission.user))
        .filter(models.Submission.session_id == session_id)
    )
    return result.scalars().all()
