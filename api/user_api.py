from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

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
