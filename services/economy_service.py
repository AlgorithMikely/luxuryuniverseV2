from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models
from services import broadcast as broadcast_service
import datetime
from decimal import Decimal
from middleware.request_id import request_id_ctx_var, ip_address_ctx_var, user_agent_ctx_var

# Constants
PAYOUT_RATE_USD = Decimal("0.0075")
CREDIT_PRICE_USD = Decimal("0.01")
MIN_WITHDRAWAL_USD = Decimal("20.00")

async def get_user_credit_balance(db: AsyncSession, user_id: int) -> int:
    """
    Fetches the global credit balance for a user.
    """
    result = await db.execute(select(models.User).filter(models.User.id == user_id))
    user = result.scalars().first()
    return user.credit_balance if user else 0

async def get_reviewer_wallet(db: AsyncSession, reviewer_id: int) -> models.ReviewerWallet:
    """
    Fetches (or creates) the USD wallet for a reviewer.
    """
    result = await db.execute(select(models.ReviewerWallet).filter(models.ReviewerWallet.reviewer_id == reviewer_id))
    wallet = result.scalars().first()
    
    if not wallet:
        wallet = models.ReviewerWallet(reviewer_id=reviewer_id, balance_usd=0, total_earnings_usd=0)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
        
    return wallet

async def process_skip_transaction(db: AsyncSession, user_id: int, reviewer_id: int, credits_amount: int, reason: str = "skip", session_id: int = None):
    """
    Atomic transaction for "Skip":
    1. Deduct Credits from User.
    2. Convert Credits to USD.
    3. Credit Reviewer USD Wallet.
    4. Log to Ledger.
    """
    if credits_amount <= 0:
        raise ValueError("Amount must be positive")

    # 1. Lock User Row
    result = await db.execute(select(models.User).filter(models.User.id == user_id).with_for_update())
    user = result.scalars().first()
    
    if not user:
        raise ValueError("User not found")
        
    if user.credit_balance < credits_amount:
        raise ValueError(f"Insufficient funds. Required: {credits_amount}, Available: {user.credit_balance}")

    # 2. Lock Reviewer Wallet Row
    # Ensure wallet exists first (handled by get_reviewer_wallet usually, but we need lock here)
    # We'll try to fetch with lock.
    result_wallet = await db.execute(select(models.ReviewerWallet).filter(models.ReviewerWallet.reviewer_id == reviewer_id).with_for_update())
    reviewer_wallet = result_wallet.scalars().first()
    
    if not reviewer_wallet:
        # Should have been created when reviewer was created, but just in case
        reviewer_wallet = models.ReviewerWallet(reviewer_id=reviewer_id, balance_usd=0, total_earnings_usd=0)
        db.add(reviewer_wallet)
        # We can't easily lock a new row before commit, but since we are in a transaction, it should be fine?
        # Actually, if we add it, we should flush.
        await db.flush() 

    # 3. Calculate USD
    usd_earned = Decimal(credits_amount) * PAYOUT_RATE_USD
    platform_revenue = (Decimal(credits_amount) * CREDIT_PRICE_USD) - usd_earned
    
    # 4. Execute Transfer
    user.credit_balance -= credits_amount
    reviewer_wallet.balance_usd += usd_earned
    reviewer_wallet.total_earnings_usd += usd_earned
    
    # 5. Log to Ledger
    ledger_entry = models.TransactionLedger(
        user_id=user_id,
        reviewer_id=reviewer_id,
        session_id=session_id,
        action=reason,
        credits_spent=credits_amount,
        usd_earned=usd_earned,
        platform_revenue_usd=platform_revenue,
        exchange_rate_snapshot=PAYOUT_RATE_USD,
        meta_data={"reason": reason},
        request_id=request_id_ctx_var.get(),
        ip_address=ip_address_ctx_var.get(),
        user_agent=user_agent_ctx_var.get()
    )
    db.add(ledger_entry)
    
    await db.commit()
    
    # 6. Emit Updates
    # We need to emit to User (Credits) and Reviewer (USD)
    # The frontend expects 'balance_update' event.
    # For user, we send updated credit balance.
    # For reviewer, we send updated USD balance (if they are watching dashboard).
    
    # TODO: Update broadcast service to handle global credits vs reviewer wallet
    # For now, we emit the user's credit balance.
    # Note: The old 'emit_balance_update' took reviewer_id, user_id, balance.
    # Since credits are global, reviewer_id is less relevant for the user's balance, 
    # but the frontend might be listening on a reviewer-specific channel.
    # We should probably emit to the user's personal room.
    
    await broadcast_service.emit_balance_update(reviewer_id, user_id, user.credit_balance)
    
    return True

async def purchase_credits(db: AsyncSession, user_id: int, credits_amount: int, amount_paid_usd: float, provider: str, reference_id: str):
    """
    Adds credits to a user's account after a successful payment.
    """
    if credits_amount <= 0:
        raise ValueError("Amount must be positive")

    result = await db.execute(select(models.User).filter(models.User.id == user_id).with_for_update())
    user = result.scalars().first()
    
    if not user:
        raise ValueError("User not found")

    user.credit_balance += credits_amount
    
    # Log to Ledger
    ledger_entry = models.TransactionLedger(
        user_id=user_id,
        reviewer_id=None, # Platform transaction
        action="purchase",
        # The ledger schema has 'credits_spent'. Maybe we should interpret negative spent as added?
        # Or add a 'credits_added' column? 
        # For now, let's use 'credits_spent' = -credits_amount to indicate addition?
        # Or just rely on 'action' = 'purchase' and store the amount in 'credits_spent' as the amount involved?
        # Let's use 'credits_spent' as 'credits_delta' effectively, but the column name is 'credits_spent'.
        # Let's store it as negative to imply "negative spend" = gain? 
        # Or just store positive and know that 'purchase' adds it.
        # Let's store positive and rely on action.
        credits_spent=credits_amount, 
        usd_earned=0,
        exchange_rate_snapshot=None,
        meta_data={"provider": provider, "reference_id": reference_id, "amount_paid_usd": amount_paid_usd},
        request_id=request_id_ctx_var.get(),
        ip_address=ip_address_ctx_var.get(),
        user_agent=user_agent_ctx_var.get()
    )
    db.add(ledger_entry)
    
    await db.commit()
    
    # Emit update
    # We pass 0 as reviewer_id since it's a global update
    await broadcast_service.emit_balance_update(0, user_id, user.credit_balance)
    
    return user.credit_balance

# Deprecated / Compatibility Methods
async def get_balance(db: AsyncSession, reviewer_id: int, user_id: int) -> int:
    """
    Deprecated: Returns global credit balance.
    Ignores reviewer_id since credits are global.
    """
    return await get_user_credit_balance(db, user_id)

async def add_coins(db: AsyncSession, reviewer_id: int, user_id: int, amount: int, reason: str, meta_data: dict = None):
    """
    Deprecated: Adapts old 'add_coins' to 'purchase_credits' (without payment info).
    Used for freebies/adjustments.
    """
    return await purchase_credits(db, user_id, amount, 0.0, "manual_adjustment", "legacy_add_coins")

async def deduct_coins(db: AsyncSession, reviewer_id: int, user_id: int, amount: int, reason: str, meta_data: dict = None):
    """
    Deprecated: Adapts old 'deduct_coins' to 'process_skip_transaction'.
    """
    # Note: This forces a 'skip' transaction structure even if it's just a deduction.
    # If it's not a skip (e.g. penalty), we might not want to credit the reviewer?
    # But in the old system, deductions were usually for skips.
    # If reason is 'submission_fee', it's a skip.
    
    if reason == "submission_fee":
        await process_skip_transaction(db, user_id, reviewer_id, amount, reason)
    else:
        # Just deduct credits without paying reviewer?
        # Implement simple deduction
        result = await db.execute(select(models.User).filter(models.User.id == user_id).with_for_update())
        user = result.scalars().first()
        if user and user.credit_balance >= amount:
            user.credit_balance -= amount
            ledger_entry = models.TransactionLedger(
                user_id=user_id,
                reviewer_id=reviewer_id,
                action=reason,
                credits_spent=amount,
                usd_earned=0,
                exchange_rate_snapshot=None,
                meta_data=meta_data,
                request_id=request_id_ctx_var.get(),
                ip_address=ip_address_ctx_var.get(),
                user_agent=user_agent_ctx_var.get()
            )
            db.add(ledger_entry)
            await db.commit()
            await broadcast_service.emit_balance_update(reviewer_id, user_id, user.credit_balance)
        else:
            raise ValueError("Insufficient funds")
