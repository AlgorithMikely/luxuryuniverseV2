from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models
from services import broadcast as broadcast_service
import datetime

async def add_coins(db: AsyncSession, reviewer_id: int, user_id: int, amount: int, reason: str, meta_data: dict = None):
    if amount <= 0:
        raise ValueError("Amount must be positive")
    
    # Create a transaction for the audit log
    transaction = models.Transaction(
        reviewer_id=reviewer_id,
        user_id=user_id,
        amount=amount,
        reason=reason,
        meta_data=meta_data
    )
    db.add(transaction)

    # Find the user's wallet, or create a new one. Use with_for_update() for atomic locking.
    result = await db.execute(
        select(models.Wallet)
        .filter(
            models.Wallet.user_id == user_id,
            models.Wallet.reviewer_id == reviewer_id
        )
        .with_for_update()
    )
    wallet = result.scalars().first()

    if wallet:
        wallet.balance += amount
    else:
        # If creating a new wallet, we don't need a lock since it's an insert,
        # but we should be careful about unique constraints if multiple inserts happen.
        # For now, we assume the unique constraint on (user_id, reviewer_id) will handle it
        # and raise an IntegrityError if we lose the race, which is acceptable.
        wallet = models.Wallet(
            user_id=user_id,
            reviewer_id=reviewer_id,
            balance=amount
        )
        db.add(wallet)

    await db.commit()
    await db.refresh(wallet)

    # Log to file
    log_transaction(reviewer_id, user_id, amount, reason, "CREDIT")

    # Emit a balance update
    await broadcast_service.emit_balance_update(reviewer_id, user_id, wallet.balance)

    return wallet

async def deduct_coins(db: AsyncSession, reviewer_id: int, user_id: int, amount: int, reason: str, meta_data: dict = None):
    if amount <= 0:
        raise ValueError("Amount must be positive")

    # Create a transaction for the audit log
    transaction = models.Transaction(
        reviewer_id=reviewer_id,
        user_id=user_id,
        amount=-amount, # Store as negative for deduction
        reason=reason,
        meta_data=meta_data
    )
    db.add(transaction)

    # Find the user's wallet
    result = await db.execute(
        select(models.Wallet)
        .filter(
            models.Wallet.user_id == user_id,
            models.Wallet.reviewer_id == reviewer_id
        )
        .with_for_update()
    )
    wallet = result.scalars().first()

    if not wallet or wallet.balance < amount:
        # Should we raise an error or just return False?
        # Raising an error is safer for transactions.
        raise ValueError("Insufficient funds")

    wallet.balance -= amount
    
    await db.commit()
    await db.refresh(wallet)

    # Log to file
    log_transaction(reviewer_id, user_id, amount, reason, "DEBIT")

    # Emit a balance update
    await broadcast_service.emit_balance_update(reviewer_id, user_id, wallet.balance)

    return wallet

def log_transaction(reviewer_id: int, user_id: int, amount: int, reason: str, type: str):
    try:
        with open("transactions.log", "a") as f:
            timestamp = datetime.datetime.now().isoformat()
            f.write(f"[{timestamp}] [{type}] Reviewer: {reviewer_id} | User: {user_id} | Amount: {amount} | Reason: {reason}\n")
    except Exception as e:
        print(f"Failed to log transaction: {e}")

async def get_balance(db: AsyncSession, reviewer_id: int, user_id: int) -> int:
    result = await db.execute(
        select(models.Wallet)
        .filter(
            models.Wallet.user_id == user_id,
            models.Wallet.reviewer_id == reviewer_id
        )
    )
    wallet = result.scalars().first()
    return wallet.balance if wallet else 0

async def get_economy_config(db: AsyncSession, reviewer_id: int) -> dict:
    result = await db.execute(
        select(models.EconomyConfig)
        .filter(models.EconomyConfig.reviewer_id == reviewer_id)
    )
    configs = result.scalars().all()
    return {config.event_name: config.coin_amount for config in configs}
