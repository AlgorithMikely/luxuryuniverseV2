from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
import base64
import os
import models
import schemas
import security
from database import get_db
from services.payment_service import payment_service
from services import queue_service, economy_service, user_service
from config import settings
from config import settings
import datetime
from middleware.rate_limit import limiter

router = APIRouter(prefix="/paypal", tags=["PayPal"])

# PayPal API Base URL (Sandbox for now, switch to Live based on config)
PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com" # Default to sandbox

async def get_paypal_access_token(client_id: str, client_secret: str, mode: str = "sandbox"):
    base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
    
    async with httpx.AsyncClient() as client:
        auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        response = await client.post(
            f"{base_url}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={"grant_type": "client_credentials"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with PayPal")
            
        return response.json()["access_token"]

@router.post("/create-order")
@limiter.limit("5/minute")
async def create_order(
    data: schemas.PaymentIntentCreate,
    reviewer_id: int,
    submission_id: int = None,
    payment_type: str = "priority_request",
    current_user: models.User | None = Depends(security.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    request: Request = None # Required for slowapi
):
    # Get Reviewer's PayPal Config
    config = await payment_service.get_provider_config(db, reviewer_id, "paypal")
    if not config or not config.is_enabled or not config.credentials.get("client_id"):
        raise HTTPException(status_code=400, detail="Reviewer does not accept PayPal payments")

    client_id = config.credentials["client_id"]
    client_secret = config.credentials["client_secret"]
    mode = config.credentials.get("mode", "sandbox")
    
    base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"

    # Validate Guest Requirements
    if not current_user and not data.email:
        raise HTTPException(status_code=400, detail="Email is required for guest payments")

    try:
        access_token = await get_paypal_access_token(client_id, client_secret, mode)
        
        amount_val = data.amount / 100.0 # Convert cents to dollars
        
        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": data.currency.upper(),
                        "value": f"{amount_val:.2f}"
                    },
                    "description": f"{payment_type} - {data.track_title or 'Submission'}"
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/v2/checkout/orders",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=order_payload
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail=f"PayPal Order Error: {response.text}")
                
            order_data = response.json()
            return {"order_id": order_data["id"]}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/capture-order")
@limiter.limit("5/minute")
async def capture_order(
    data: dict,
    reviewer_id: int,
    submission_id: int = None,
    payment_type: str = "priority_request",
    current_user: models.User | None = Depends(security.get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    request: Request = None # Required for slowapi
):
    order_id = data.get("order_id")
    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order_id")

    # Get Reviewer's PayPal Config
    config = await payment_service.get_provider_config(db, reviewer_id, "paypal")
    if not config or not config.is_enabled:
        raise HTTPException(status_code=400, detail="PayPal not configured")

    client_id = config.credentials["client_id"]
    client_secret = config.credentials["client_secret"]
    mode = config.credentials.get("mode", "sandbox")
    base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"

    try:
        access_token = await get_paypal_access_token(client_id, client_secret, mode)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/v2/checkout/orders/{order_id}/capture",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail=f"PayPal Capture Error: {response.text}")
                
            capture_data = response.json()
            
            if capture_data["status"] == "COMPLETED":
                # Process Fulfillment
                # Extract amount from capture
                amount_str = capture_data["purchase_units"][0]["payments"]["captures"][0]["amount"]["value"]
                amount_cents = int(float(amount_str) * 100)
                
                if payment_type == "priority_request" or payment_type == "skip_line":
                    if submission_id:
                         # Existing submission
                         submission_id = int(submission_id)
                         priority_value = int(amount_cents / 100)
                         await queue_service.update_priority(db, submission_id, priority_value)
                    else:
                        # Guest Submission
                        email = data.get("email")
                        track_url = data.get("track_url")
                        track_title = data.get("track_title", "Untitled")
                        
                        if email and track_url:
                             # 1. User Resolution
                            user = await user_service.create_guest_user(db, email)
                            
                            # 2. Credit Wallet
                            credits = amount_cents
                            await economy_service.purchase_credits(db, user.id, credits, amount_cents / 100.0, "paypal_guest", order_id)
                            
                            # 3. Debit Wallet
                            await economy_service.process_skip_transaction(db, user.id, reviewer_id, credits, "Submission to Reviewer")
                            
                            # 4. Finalize Submission
                            is_priority = True # Assumed if paying
                            priority_value = coins
                            
                            new_submission = models.Submission(
                                reviewer_id=reviewer_id,
                                user_id=user.id,
                                track_url=track_url,
                                track_title=track_title,
                                status="pending",
                                is_priority=is_priority,
                                priority_value=priority_value,
                                submitted_at=datetime.datetime.now(datetime.UTC)
                            )
                            db.add(new_submission)
                            
                # Record 5% Platform Fee
                fee_amount = int(amount_cents * 0.05)
                if fee_amount > 0:
                    platform_fee = models.PlatformFee(
                        reviewer_id=reviewer_id,
                        amount=fee_amount,
                        currency="USD",
                        source="paypal",
                        reference_id=order_id,
                        is_settled=False
                    )
                    db.add(platform_fee)
                
                await db.commit()
                
                return {"status": "COMPLETED", "details": capture_data}
            else:
                 raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {capture_data['status']}")

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/config/{reviewer_id}")
async def get_paypal_config(reviewer_id: int, db: AsyncSession = Depends(get_db)):
    """
    Returns the public PayPal configuration (Client ID, Mode) for a reviewer.
    """
    config = await payment_service.get_provider_config(db, reviewer_id, "paypal")
    if not config or not config.is_enabled:
        raise HTTPException(status_code=404, detail="PayPal not enabled for this reviewer")
    
    creds = config.credentials or {}
    client_id = creds.get("client_id")
    mode = creds.get("mode", "sandbox")
    
    if not client_id:
        raise HTTPException(status_code=500, detail="PayPal configuration incomplete")
        
    return {
        "client_id": client_id,
        "mode": mode,
        "currency": "USD"
    }

@router.put("/config")
async def update_paypal_config(
    data: schemas.PaymentConfigUpdate,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the PayPal configuration for the current reviewer.
    """
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=400, detail="User is not a reviewer")
        
    # Ensure provider is set to paypal in the update (though service handles it by arg)
    # We just pass the data to the service
    
    config = await payment_service.update_provider_config(
        db, 
        current_user.reviewer_profile.id, 
        "paypal", 
        data
    )
    
    return config

@router.post("/payout")
async def request_payout(
    data: dict,
    current_user: models.User = Depends(security.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates a payout to the reviewer via PayPal Payouts API.
    """
    if not current_user.reviewer_profile:
        raise HTTPException(status_code=400, detail="User is not a reviewer")
    
    reviewer_id = current_user.reviewer_profile.id
    payout_email = data.get("email")
    if not payout_email:
        raise HTTPException(status_code=400, detail="Payout email is required")

    # 1. Check Balance
    wallet = await economy_service.get_reviewer_wallet(db, reviewer_id)
    if wallet.balance_usd < economy_service.MIN_WITHDRAWAL_USD:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Minimum withdrawal is ${economy_service.MIN_WITHDRAWAL_USD}")

    amount_to_withdraw = float(wallet.balance_usd) # Convert Decimal to float for PayPal API
    
    # 2. Authenticate Platform PayPal (Sender)
    # We use Platform credentials here, not Reviewer credentials
    platform_client_id = os.getenv("PLATFORM_PAYPAL_CLIENT_ID")
    platform_client_secret = os.getenv("PLATFORM_PAYPAL_CLIENT_SECRET")
    mode = os.getenv("PAYPAL_MODE", "sandbox")
    
    if not platform_client_id or not platform_client_secret:
         raise HTTPException(status_code=500, detail="Platform PayPal configuration missing")

    try:
        access_token = await get_paypal_access_token(platform_client_id, platform_client_secret, mode)
        base_url = "https://api-m.sandbox.paypal.com" if mode == "sandbox" else "https://api-m.paypal.com"
        
        # 3. Create Payout Batch
        import uuid
        batch_id = f"Payout_{reviewer_id}_{uuid.uuid4()}"
        
        payout_payload = {
            "sender_batch_header": {
                "sender_batch_id": batch_id,
                "email_subject": "You have a payout from Luxury Universe",
                "email_message": "Thank you for your reviews! Here is your payout.",
                "recipient_type": "EMAIL"
            },
            "items": [
                {
                    "amount": {
                        "value": f"{amount_to_withdraw:.2f}",
                        "currency": "USD"
                    },
                    "receiver": payout_email,
                    "note": "Reviewer Withdrawal",
                    "sender_item_id": f"Withdrawal_{reviewer_id}_{datetime.datetime.now().timestamp()}"
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/v1/payments/payouts",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=payout_payload
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail=f"PayPal Payout Error: {response.text}")
            
            payout_data = response.json()
            batch_status = payout_data["batch_header"]["batch_status"]
            
            if batch_status in ["PENDING", "PROCESSING", "SUCCESS"]:
                # 4. Deduct from Wallet
                # We deduct the full amount. Platform pays fees on top (PayPal charges sender).
                
                # Convert back to Decimal for subtraction if needed, or rely on SQLAlchemy casting
                # wallet.balance_usd is Numeric (Decimal)
                from decimal import Decimal
                wallet.balance_usd -= Decimal(str(amount_to_withdraw))
                wallet.total_earnings_usd += 0 # Earnings don't change on withdrawal
                
                # Log to Ledger
                ledger_entry = models.TransactionLedger(
                    user_id=None, 
                    reviewer_id=reviewer_id,
                    action="withdraw",
                    credits_spent=0,
                    usd_earned=-Decimal(str(amount_to_withdraw)), # Negative earned = withdrawal
                    exchange_rate_snapshot=None,
                    meta_data={
                        "payout_batch_id": payout_data["batch_header"]["payout_batch_id"],
                        "payout_email": payout_email,
                        "provider": "paypal"
                    }
                )
                db.add(ledger_entry)
                await db.commit()
                
                return {"status": "success", "batch_id": payout_data["batch_header"]["payout_batch_id"], "amount": f"{amount_to_withdraw:.2f}"}
            else:
                raise HTTPException(status_code=400, detail=f"Payout failed with status: {batch_status}")

    except Exception as e:
        import logging
        logging.error(f"Payout failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
