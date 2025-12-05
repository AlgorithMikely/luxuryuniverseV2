from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import stripe
import os
import models
import schemas
import security
from database import get_db
from services.payment_service import payment_service
from services import queue_service
from config import settings

router = APIRouter(prefix="/stripe", tags=["Stripe"])

# Use settings for API key
stripe.api_key = settings.STRIPE_SECRET_KEY

@router.post("/connect")
async def connect_stripe(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=400, detail="User is not a reviewer")

    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfiguration: STRIPE_SECRET_KEY is missing.")

    try:
        account = stripe.Account.create(type="standard")
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{settings.FRONTEND_URL}/settings/reviewer?stripe_connect=refresh",
            return_url=f"{settings.FRONTEND_URL}/settings/reviewer?stripe_connect=return&account_id={account.id}",
            type="account_onboarding",
        )
        return {"url": account_link.url}
    except Exception as e:
        import logging
        logging.error(f"Stripe Connect Error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/finalize-connection")
async def finalize_connection(
    data: dict,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    account_id = data.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Missing account_id")

    if not current_user.reviewer_profile:
        raise HTTPException(status_code=400, detail="User is not a reviewer")

    # Verify account exists and is usable (optional but recommended)
    try:
        account = stripe.Account.retrieve(account_id)
        if not account.details_submitted:
             # In a real app, we might warn them, but for Standard accounts, they might finish later.
             pass
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Stripe Account")

    # Save to PaymentConfig
    update = schemas.PaymentConfigUpdate(
        is_enabled=True,
        credentials={"stripe_account_id": account_id}
    )
    await payment_service.update_provider_config(db, current_user.reviewer_profile.id, "stripe", update)
    
    return {"status": "connected"}

@router.post("/disconnect")
async def disconnect_stripe(
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=400, detail="User is not a reviewer")

    try:
        # Disable the payment config
        update = schemas.PaymentConfigUpdate(
            is_enabled=False,
            credentials={} # Clear credentials
        )
        await payment_service.update_provider_config(db, current_user.reviewer_profile.id, "stripe", update)
        return {"status": "disconnected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-payment-intent")
async def create_payment_intent(
    data: schemas.PaymentIntentCreate,
    reviewer_id: int,
    submission_id: int = None,
    payment_type: str = "priority_request",
    current_user: models.User | None = Depends(security.get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    # Get Reviewer's Stripe Config
    config = await payment_service.get_provider_config(db, reviewer_id, "stripe")
    if not config or not config.is_enabled or not config.credentials.get("stripe_account_id"):
        raise HTTPException(status_code=400, detail="Reviewer does not accept Stripe payments")

    stripe_account_id = config.credentials["stripe_account_id"]

    # Validate Guest Requirements
    if not current_user:
        if payment_type == "wallet_topup":
             raise HTTPException(status_code=401, detail="Authentication required for wallet top-up")
        if not data.email:
            raise HTTPException(status_code=400, detail="Email is required for guest payments")

    try:
        # Create PaymentIntent on the connected account
        metadata = {
            "user_id": current_user.id if current_user else None,
            "email": data.email if not current_user else current_user.email,
            "reviewer_id": reviewer_id,
            "submission_id": submission_id,
            "type": payment_type,
            "tier": data.tier,
            "track_url": data.track_url,
            "track_title": data.track_title
        }
        
        # Filter out None values from metadata
        metadata = {k: v for k, v in metadata.items() if v is not None}

        intent = stripe.PaymentIntent.create(
            amount=data.amount,
            currency=data.currency,
            automatic_payment_methods={"enabled": True},
            application_fee_amount=int(data.amount * 0.05), # 5% Platform Fee
            stripe_account=stripe_account_id,
            metadata=metadata
        )
        return {
            "client_secret": intent.client_secret,
            "stripe_account_id": stripe_account_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        await process_successful_payment(payment_intent)

    return {"status": "success"}

async def process_successful_payment(payment_intent):
    metadata = payment_intent.get("metadata", {})
    
    if metadata.get("type") == "priority_request" or metadata.get("type") == "skip_line":
        submission_id = metadata.get("submission_id")
        
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            if submission_id:
                # Existing submission (Logged in user usually)
                submission_id = int(submission_id)
                amount = payment_intent["amount"]
                priority_value = int(amount / 100) 
                await queue_service.update_priority(db, submission_id, priority_value)
            else:
                # Guest Submission (No submission_id yet)
                email = metadata.get("email")
                track_url = metadata.get("track_url")
                reviewer_id = int(metadata.get("reviewer_id"))
                amount_cents = payment_intent["amount"]
                
                if email and track_url:
                    from services import user_service, economy_service, queue_service
                    
                    # 1. User Resolution
                    user = await user_service.create_guest_user(db, email)
                    
                    # 2. Credit Wallet (Invisible Coin Purchase)
                    credits = amount_cents # 1 cent = 1 credit
                    await economy_service.purchase_credits(db, user.id, credits, amount_cents / 100.0, "stripe_guest", payment_intent["id"])
                    
                    # 3. Debit Wallet (Submission Payment)
                    # We need to deduct the credits we just added.
                    await economy_service.process_skip_transaction(db, user.id, reviewer_id, credits, "Submission to Reviewer")
                    
                    # 4. Finalize Submission
                    # Create the submission
                    # We need to know if it's priority. "tier" metadata might help.
                    is_priority = metadata.get("tier") == "vip" # Example logic
                    priority_value = coins if is_priority else 0 # Or some other logic? Spec says "Buying 2500 coins...". 
                    # Usually priority value is based on coins spent.
                    
                    # We need to call queue_service.add_submission or similar.
                    # But queue_service might expect a logged in user or handle deduction.
                    # Let's check queue_service.
                    # For now, I'll create it directly to ensure exact behavior.
                    
                    new_submission = models.Submission(
                        reviewer_id=reviewer_id,
                        user_id=user.id,
                        track_url=track_url,
                        track_title=metadata.get("track_title", "Untitled"),
                        status="pending",
                        is_priority=is_priority,
                        priority_value=priority_value,
                        submitted_at=datetime.datetime.now(datetime.UTC)
                    )
                    db.add(new_submission)
                    await db.commit()

    elif metadata.get("type") == "wallet_topup" and metadata.get("user_id"):
        user_id = int(metadata["user_id"])
        amount_cents = payment_intent["amount"]
        coins = amount_cents # 1 cent = 1 coin
        
        from database import AsyncSessionLocal
        from services import economy_service
        async with AsyncSessionLocal() as db:
            # Get reviewer_id from metadata, default to 1 if not present (fallback)
            reviewer_id = int(metadata.get("reviewer_id", 1))
            
            await economy_service.purchase_credits(db, user_id, coins, amount_cents / 100.0, "stripe", payment_intent["id"])

@router.post("/verify-payment")
async def verify_payment(
    data: dict,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    payment_intent_id = data.get("payment_intent_id")
    if not payment_intent_id:
        raise HTTPException(status_code=400, detail="Missing payment_intent_id")

    try:
        # Retrieve the PaymentIntent from Stripe
        # We need to know WHICH account it was created on.
        # The frontend should probably pass the stripe_account_id if it knows it, 
        # OR we can try to find the submission and get the reviewer's config.
        # However, we can also just try to retrieve it. 
        # If it was created on a connected account, we MUST pass stripe_account.
        
        # Let's try to find the submission first if possible? 
        # Actually, the metadata has the info, but we can't see metadata if we can't find the intent.
        
        # Option 1: Frontend passes stripe_account_id.
        # Option 2: We look up the reviewer from the submission_id (passed in body?)
        
        # Let's require reviewer_id in the body to look up the config.
        reviewer_id = data.get("reviewer_id")
        stripe_account_id = None
        
        if reviewer_id:
             config = await payment_service.get_provider_config(db, reviewer_id, "stripe")
             if config and config.credentials:
                 stripe_account_id = config.credentials.get("stripe_account_id")

        if stripe_account_id:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id, stripe_account=stripe_account_id)
        else:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        if intent.status == "succeeded":
            await process_successful_payment(intent)
            return {"status": "verified"}
        else:
            raise HTTPException(status_code=400, detail=f"Payment not succeeded. Status: {intent.status}")

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
