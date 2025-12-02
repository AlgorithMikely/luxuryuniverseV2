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

    # Process Achievements
    # db_user.achievements is a list of UserAchievement objects.
    # We need to map them to Schema Achievement objects.
    # We also need to hide 'is_hidden' details if not unlocked?
    # But wait, UserAchievement means it IS unlocked.
    # So we just map the achievement definition to the schema.
    achievements_list = []
    if db_user.achievements:
        for ua in db_user.achievements:
            ach_def = ua.achievement
            if ach_def:
                # Map to schema
                ach_schema = schemas.Achievement(
                    id=ach_def.id,
                    slug=ach_def.slug,
                    display_name=ach_def.display_name,
                    description=ach_def.description,
                    category=ach_def.category,
                    threshold_value=ach_def.threshold_value,
                    tier=ach_def.tier,
                    is_hidden=ach_def.is_hidden, # It's unlocked, so we return the real data even if it was hidden
                    icon_url=ach_def.icon_url,
                    role_color=ach_def.role_color,
                    role_icon=ach_def.role_icon,
                    unlocked_at=ua.unlocked_at
                )
                achievements_list.append(ach_schema)

    # TODO: We might want to return *all* achievements (locked ones too) so the UI can show progress?
    # The requirement says "Hidden Achievements... visible in list... obscured".
    # This implies we should return ALL achievements, but obscure the hidden ones if not unlocked.
    # To do this efficiently, we should probably have a separate endpoint /user/achievements/all
    # OR include all in `me` but that's heavy.
    # Let's check `schemas.UserProfile`. It has `achievements: List[Achievement]`.
    # Usually `UserProfile` is "My Profile".
    # I'll stick to returning ONLY UNLOCKED achievements in `UserProfile` for now to keep payload small.
    # If the UI needs the full list (locked/unlocked), it should fetch from a dedicated endpoint `GET /achievements`.
    # But the current task is to "Update and improve Achievements".
    # I will add a new endpoint `GET /user/me/achievements` that returns the full list with locked/unlocked state.
    # And leave `UserProfile` with just unlocked ones or empty if it's too big.
    # Let's put unlocked ones in UserProfile as requested.

    is_authorized = await user_service.is_user_authorized_for_line(db, db_user.discord_id)

    user_profile = schemas.UserProfile(
        id=db_user.id,
        discord_id=db_user.discord_id,
        username=db_user.username,
        avatar=db_user.avatar,
        reviewer_profile=db_user.reviewer_profile,
        roles=token.roles,
        moderated_reviewers=moderated_reviewers,
        spotify_connected=bool(db_user.spotify_access_token),
        achievements=achievements_list,
        is_line_authorized=is_authorized
    )
    return user_profile

@router.get("/me/achievements", response_model=list[schemas.Achievement])
async def get_my_achievements_full(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns ALL achievements.
    - Unlocked: Full details + unlocked_at.
    - Locked & Visible: Full details, no unlocked_at.
    - Locked & Hidden: Obscured details (???)
    """
    # 1. Fetch all definitions
    all_defs_result = await db.execute(select(models.AchievementDefinition))
    all_defs = all_defs_result.scalars().all()

    # 2. Fetch user unlocks
    unlocked_ids = {ua.achievement_id: ua.unlocked_at for ua in current_user.achievements}

    response_list = []
    for ach in all_defs:
        is_unlocked = ach.id in unlocked_ids

        # Obscure if Hidden AND Locked
        if ach.is_hidden and not is_unlocked:
            display_name = "???"
            description = "???"
            icon_url = None # Or a lock icon placeholder
        else:
            display_name = ach.display_name
            description = ach.description
            icon_url = ach.icon_url

        response_list.append(schemas.Achievement(
            id=ach.id,
            slug=ach.slug,
            display_name=display_name,
            description=description,
            category=ach.category,
            threshold_value=ach.threshold_value,
            tier=ach.tier,
            is_hidden=ach.is_hidden,
            icon_url=icon_url,
            role_color=ach.role_color,
            role_icon=ach.role_icon,
            unlocked_at=unlocked_ids.get(ach.id) # None if locked
        ))

    # Sort by Tier then Display Name
    response_list.sort(key=lambda x: (x.tier, x.display_name))

    return response_list

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

@router.get("/{user_id}/stats", response_model=schemas.SubmitterStats)
async def get_submitter_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    # 1. Fetch User
    result = await db.execute(select(models.User).filter(models.User.id == user_id))
    user = result.scalars().first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Fetch Submissions
    # We need to calculate average poll result and get genres
    # We'll fetch the last 50 submissions for the list, but maybe calculate stats on all?
    # For performance, let's fetch all submissions for stats calculation in Python (or do complex SQL)
    # Given scale, fetching all might be okay for now, or we limit to last 100.
    
    stmt = (
        select(models.Submission)
        .filter(models.Submission.user_id == user_id)
        .filter(models.Submission.status != "pending") # Only graded/played submissions? Or all?
        .order_by(models.Submission.submitted_at.desc())
    )
    
    result = await db.execute(stmt)
    submissions = result.scalars().all()

    # Calculate Stats
    total_poll_percent = 0
    poll_count = 0
    genres_set = set()
    
    for sub in submissions:
        if sub.poll_result_w_percent is not None:
            total_poll_percent += sub.poll_result_w_percent
            poll_count += 1
        
        if sub.genre:
            # Split by comma if multiple genres? Assuming simple string for now or single genre
            # If comma separated:
            # for g in sub.genre.split(','): genres_set.add(g.strip())
            genres_set.add(sub.genre)
            
    avg_poll = (total_poll_percent / poll_count) if poll_count > 0 else 0.0
    
    # Prepare response
    # We return the top 20 most recent submissions for the list
    recent_submissions = submissions[:20]
    
    # Map to schema
    # Note: SubmissionPublic requires 'user' field. The ORM objects should have it loaded or lazy load it.
    # Since we fetched submissions, 'user' relationship might need to be eager loaded or we assign it.
    # To be safe and efficient, let's ensure we don't trigger N+1.
    # Actually, we already have the 'user' object. We can manually attach it if needed, 
    # but Pydantic from_attributes might try to access sub.user.
    
    return schemas.SubmitterStats(
        user=user,
        average_review_score=float(user.average_review_score or 0.0),
        average_poll_result=avg_poll,
        genres=sorted(list(genres_set)),
        submissions=recent_submissions
    )
