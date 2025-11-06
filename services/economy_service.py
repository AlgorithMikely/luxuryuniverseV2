import asyncio
from sqlalchemy.orm import Session
import models
import event_service

def _add_coins_sync(db: Session, reviewer_id: int, user_id: int, amount: int, reason: str):
    transaction = models.Transaction(
        reviewer_id=reviewer_id,
        user_id=user_id,
        amount=amount,
        reason=reason
    )
    db.add(transaction)

    wallet = db.query(models.Wallet).filter(
        models.Wallet.user_id == user_id,
        models.Wallet.reviewer_id == reviewer_id
    ).first()

    if wallet:
        wallet.balance += amount
    else:
        wallet = models.Wallet(
            user_id=user_id,
            reviewer_id=reviewer_id,
            balance=amount
        )
        db.add(wallet)

    db.commit()
    db.refresh(wallet)
    return wallet

async def add_coins(db: Session, reviewer_id: int, user_id: int, amount: int, reason: str):
    wallet = await asyncio.to_thread(
        _add_coins_sync, db, reviewer_id, user_id, amount, reason
    )
    await event_service.emit_balance_update(reviewer_id, user_id, wallet.balance)
    return wallet

def get_balance(db: Session, reviewer_id: int, user_id: int) -> int:
    wallet = db.query(models.Wallet).filter(
        models.Wallet.user_id == user_id,
        models.Wallet.reviewer_id == reviewer_id
    ).first()
    return wallet.balance if wallet else 0

def get_economy_config(db: Session, reviewer_id: int) -> dict:
    configs = db.query(models.EconomyConfig).filter(
        models.EconomyConfig.reviewer_id == reviewer_id
    ).all()
    return {config.event_name: config.coin_amount for config in configs}
