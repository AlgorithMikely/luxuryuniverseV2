from sqlalchemy.orm import Session
import models
import event_service

async def add_coins(db: Session, reviewer_id: int, user_id: int, amount: int, reason: str):
    # Create a transaction for the audit log
    transaction = models.Transaction(
        reviewer_id=reviewer_id,
        user_id=user_id,
        amount=amount,
        reason=reason
    )
    db.add(transaction)

    # Find the user's wallet, or create a new one
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

    # Emit a balance update
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
