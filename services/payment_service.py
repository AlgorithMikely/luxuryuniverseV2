from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models
import schemas
from typing import List, Optional

class PaymentService:
    async def get_active_providers(self, db: AsyncSession, reviewer_id: int) -> List[schemas.PaymentConfig]:
        result = await db.execute(
            select(models.PaymentConfig)
            .filter(
                models.PaymentConfig.reviewer_id == reviewer_id,
                models.PaymentConfig.is_enabled == True
            )
        )
        return result.scalars().all()

    async def get_provider_config(self, db: AsyncSession, reviewer_id: int, provider: str) -> Optional[models.PaymentConfig]:
        result = await db.execute(
            select(models.PaymentConfig)
            .filter(
                models.PaymentConfig.reviewer_id == reviewer_id,
                models.PaymentConfig.provider == provider
            )
        )
        return result.scalars().first()

    async def update_provider_config(self, db: AsyncSession, reviewer_id: int, provider: str, update: schemas.PaymentConfigUpdate) -> models.PaymentConfig:
        config = await self.get_provider_config(db, reviewer_id, provider)
        
        if not config:
            # Create new config if it doesn't exist
            config = models.PaymentConfig(
                reviewer_id=reviewer_id,
                provider=provider,
                is_enabled=update.is_enabled if update.is_enabled is not None else False,
                credentials=update.credentials or {}
            )
            db.add(config)
        else:
            if update.is_enabled is not None:
                config.is_enabled = update.is_enabled
            if update.credentials is not None:
                # Merge or replace credentials? For now, let's merge
                current_creds = config.credentials or {}
                current_creds.update(update.credentials)
                config.credentials = current_creds

        await db.commit()
        await db.refresh(config)
        return config

payment_service = PaymentService()
