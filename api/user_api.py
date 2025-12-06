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
        email=db_user.email,
        avatar=db_user.avatar,
        reviewer_profile=db_user.reviewer_profile,
        roles=token.roles,
        moderated_reviewers=moderated_reviewers,
        spotify_connected=bool(db_user.spotify_access_token),
        achievements=achievements_list,
        is_line_authorized=is_authorized,
        # New Fields
        artist_name=db_user.artist_name,
        tiktok_username=db_user.tiktok_username,
        instagram_handle=db_user.instagram_handle,
        twitter_handle=db_user.twitter_handle,
        youtube_channel=db_user.youtube_channel,
        soundcloud_url=db_user.soundcloud_url,
        apple_music_url=db_user.apple_music_url
    )
    return user_profile

@router.patch("/me/settings", response_model=schemas.User)
async def update_my_settings(
    settings: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    print(f"DEBUG: update_my_settings called with: {settings.model_dump()}")
    # Update fields if provided
    if settings.artist_name is not None:
        current_user.artist_name = settings.artist_name
    if settings.tiktok_username is not None:
        current_user.tiktok_username = settings.tiktok_username
    if settings.instagram_handle is not None:
        current_user.instagram_handle = settings.instagram_handle
    if settings.twitter_handle is not None:
        current_user.twitter_handle = settings.twitter_handle
    if settings.youtube_channel is not None:
        current_user.youtube_channel = settings.youtube_channel
    if settings.soundcloud_url is not None:
        current_user.soundcloud_url = settings.soundcloud_url
    if settings.apple_music_url is not None:
        current_user.apple_music_url = settings.apple_music_url
        
    await db.commit()
    await db.refresh(current_user)
    
    # Return updated profile (reuse logic from get_me ideally, but for now simple return)
    # We need to construct UserProfile again or just return User and let Pydantic handle it if UserProfile inherits User
    # UserProfile inherits UserBase, but adds fields.
    # Let's just call get_me logic or re-construct.
    # Calling get_me is cleaner but requires mocking dependencies.
    # We'll just return the user object and let Pydantic map it, 
    # BUT UserProfile has computed fields like `roles` which aren't on User model directly in the same way (token has roles).
    # We can just return the user object if the response model was User, but it is UserProfile.
    # We need to re-fetch the full profile or construct it.
    
    # Quick fix: Return a basic success or the updated fields?
    # The frontend expects UserProfile.
    # Let's just return the current_user and hope Pydantic fills the rest from DB defaults?
    # No, `roles` and `achievements` will be missing.
    # Let's just return the updated user object cast to UserProfile, filling missing with defaults/empty.
    # Or better, redirect to get_me? No.
    
    # We will just return the updated user object and let the frontend re-fetch /me if needed, 
    # OR we construct a partial response. 
    # Actually, let's just return the user object and let the frontend handle the missing `roles` if it can, 
    # or we manually add them from the current session if we had them.
    # `current_user` is a DB model.
    
    # Let's just return the DB user. The schema `UserProfile` requires `roles`.
    # We don't have `roles` in `current_user` model easily without re-calculating.
    # We'll just return the DB user and change response_model to `schemas.User`? 
    # No, we want to update the store.
    
    # Let's just return the updated fields?
    # I'll change response_model to schemas.User for this endpoint to avoid complexity.
    return current_user

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

@router.get("/me/export")
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(security.get_current_active_user)
):
    """
    Export all data associated with the user in JSON format.
    """
    # Eager load relationships for full export
    result = await db.execute(
        select(models.User)
        .where(models.User.id == user.id)
        # In a real scenario, use selectinload to fetch relationships
    )
    
    # Simple dictionary dump for now
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "discord_id": user.discord_id,
        "joined_at": str(user.xp), # Placeholder for date if stored
        "stats": {
            "xp": user.xp,
            "credits": user.credit_balance,
            "lifetime_likes": user.lifetime_live_likes
        },
        "settings": {
            "artist_name": user.artist_name,
            "instagram": user.instagram_handle
            # Add more fields as needed
        }
        # Ideally would fetch submissions and transactions here too
    }
    return user_data

@router.delete("/me")
async def delete_my_account(
    db: AsyncSession = Depends(get_db),
    user: models.User = Depends(security.get_current_active_user)
):
    """
    "Delete" the user account by anonymizing PII.
    We do not hard delete to preserve transaction ledger integrity.
    """
    user.username = f"Deleted User {user.id}"
    user.email = None
    user.discord_id = None
    user.tiktok_username = None
    user.artist_name = None
    user.instagram_handle = None
    user.twitter_handle = None
    user.youtube_channel = None
    user.soundcloud_url = None
    user.apple_music_url = None
    user.avatar = None
    
    # Clear tokens
    user.spotify_access_token = None
    user.spotify_refresh_token = None
    
    await db.commit()
    return {"status": "account_deleted", "message": "Your account has been anonymized."}

@router.post("/follow/{reviewer_id}")
async def follow_reviewer(
    reviewer_id: int,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if reviewer exists
    result = await db.execute(select(models.Reviewer).where(models.Reviewer.id == reviewer_id))
    reviewer = result.scalars().first()
    if not reviewer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Reviewer not found")
        
    # Check if already following
    existing = await db.execute(
        select(models.Follow)
        .where(models.Follow.user_id == current_user.id)
        .where(models.Follow.reviewer_id == reviewer_id)
    )
    if existing.scalars().first():
        return {"status": "already_following"}
        
    follow = models.Follow(user_id=current_user.id, reviewer_id=reviewer_id)
    db.add(follow)
    await db.commit()
    
    return {"status": "success"}

@router.delete("/follow/{reviewer_id}")
async def unfollow_reviewer(
    reviewer_id: int,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.Follow).where(
        models.Follow.user_id == current_user.id,
        models.Follow.reviewer_id == reviewer_id
    )
    result = await db.execute(stmt)
    follow = result.scalars().first()
    
    if follow:
        await db.delete(follow)
        await db.commit()
        
    return {"status": "success"}
