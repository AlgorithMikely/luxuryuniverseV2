from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

import models
import schemas
import security
from database import get_db
from services import economy_service, user_service, queue_service

router = APIRouter(prefix="/user", tags=["User"])

@router.get("/me", response_model=schemas.UserProfile)
async def get_me(
    db_user: models.User = Depends(security.get_current_active_user),
    token: schemas.TokenData = Depends(security.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Manually construct the UserProfile to include roles from the token
    moderated_reviewers = []
    if "admin" in token.roles:
        users_with_profiles = await user_service.get_all_reviewers(db)
        moderated_reviewers = [u.reviewer_profile for u in users_with_profiles if u.reviewer_profile]

    user_profile = schemas.UserProfile(
        id=db_user.id,
        discord_id=db_user.discord_id,
        username=db_user.username,
        avatar=db_user.avatar,
        reviewer_profile=db_user.reviewer_profile,
        roles=token.roles,
        moderated_reviewers=moderated_reviewers,
        spotify_connected=bool(db_user.spotify_access_token),
    )
    return user_profile

@router.get("/me/balance")
async def get_my_balance(
    reviewer_id: int = Query(...),
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    balance = await economy_service.get_balance(db, reviewer_id=reviewer_id, user_id=current_user.id)
    return {"balance": balance}

@router.get("/me/submissions", response_model=list[schemas.SubmissionWithReviewer])
async def get_my_submissions(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await queue_service.get_submissions_by_user(db, user_id=current_user.id)

@router.get("/recent-tracks", response_model=list[schemas.RecentTrack])
async def get_recent_tracks(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the most recent submission data for each unique song title/artist combo
    the user has uploaded. Uses a Window Function to filter duplicates.
    """
    # Subquery to rank submissions by created_at per track_title (case insensitive)
    # Note: We group by track_title. Ideally we should group by artist too,
    # but currently Submission model doesn't strictly have 'artist' separate from title unless parsed.
    # The spec query says "PARTITION BY LOWER(song_title)".
    # We will assume track_title contains the song name.

    subquery = (
        select(
            models.Submission,
            func.row_number().over(
                partition_by=func.lower(models.Submission.track_title),
                order_by=desc(models.Submission.submitted_at)
            ).label("rn")
        )
        .filter(models.Submission.user_id == current_user.id)
        .filter(models.Submission.track_title.is_not(None))
        .subquery()
    )

    # Select from the subquery where row_number (rn) == 1
    # We need to alias the subquery to select columns from it
    # SQLAlchemy Core usage:
    stmt = (
        select(subquery)
        .where(subquery.c.rn == 1)
        .order_by(subquery.c.submitted_at.desc())
        .limit(20)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Map result rows to schema
    # The row contains all columns of Submission plus 'rn'.
    # We map to RecentTrack schema.
    recent_tracks = []
    for row in rows:
        # accessing columns by name from the row tuple/mapping
        track = schemas.RecentTrack(
            id=row.id,
            track_title=row.track_title,
            artist_name=current_user.username, # Default to user's name as artist if not stored separately
            cover_art_url=None, # Not currently stored in Submission model, maybe retrieve from OEmbed or metadata later
            file_url=row.track_url,
            hook_start_time=row.hook_start_time,
            created_at=row.submitted_at
        )
        recent_tracks.append(track)

    return recent_tracks

@router.patch("/submissions/{submission_id}", response_model=schemas.Submission)
async def update_submission(
    submission_id: int,
    submission_update: schemas.SubmissionUpdate,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership
    from sqlalchemy import select
    result = await db.execute(select(models.Submission).filter(models.Submission.id == submission_id))
    submission = result.scalars().first()

    if not submission:
         from fastapi import HTTPException
         raise HTTPException(status_code=404, detail="Submission not found")

    if submission.user_id != current_user.id:
         from fastapi import HTTPException
         raise HTTPException(status_code=403, detail="Not authorized to edit this submission")

    updated_submission = await queue_service.update_submission_details(db, submission_id, submission_update)
    return updated_submission

@router.get("/me/transactions", response_model=list[schemas.Transaction])
async def get_my_transactions(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.timestamp.desc())
    )
    return result.scalars().all()

@router.post("/me/create-payment-intent", response_model=schemas.PaymentIntentResponse)
async def create_payment_intent(
    payment_intent: schemas.PaymentIntentCreate,
    current_user: models.User = Depends(security.get_current_active_user),
):
    import stripe
    import os
    
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe.api_key:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Stripe configuration missing")

    try:
        intent = stripe.PaymentIntent.create(
            amount=payment_intent.amount,
            currency=payment_intent.currency,
            automatic_payment_methods={"enabled": True},
            metadata={"user_id": current_user.id, "type": "wallet_topup"}
        )
        return {"client_secret": intent.client_secret}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
