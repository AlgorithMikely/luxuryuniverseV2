from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models
import schemas
from typing import List, Optional

from cryptography.fernet import Fernet
from config import settings
import json

class PaymentService:
    def __init__(self):
        self.fernet = None
        if settings.ENCRYPTION_KEY:
            try:
                self.fernet = Fernet(settings.ENCRYPTION_KEY)
            except Exception as e:
                print(f"Warning: Invalid ENCRYPTION_KEY. Encryption disabled. Error: {e}")

    def _encrypt_credentials(self, credentials: dict) -> dict:
        if not self.fernet or not credentials:
            return credentials
        
        # We only encrypt sensitive fields, or the whole blob?
        # Let's encrypt specific sensitive fields to allow searching/viewing others if needed.
        # Actually, for simplicity and security, let's encrypt the 'client_secret' and 'stripe_secret_key' if present.
        # Or better, let's just encrypt the whole credentials blob if we want to be safe, 
        # BUT the database column is JSON. Storing a string in JSON column is fine.
        # However, to maintain compatibility with existing unencrypted data, we might need a flag or check.
        
        # Strategy: 
        # 1. We will encrypt specific keys: 'client_secret', 'access_token', 'refresh_token'.
        # 2. 'client_id' and 'stripe_account_id' can remain plain text.
        
        sensitive_keys = ['client_secret', 'access_token', 'refresh_token', 'stripe_secret_key']
        encrypted_creds = credentials.copy()
        
        for key in sensitive_keys:
            if key in encrypted_creds and encrypted_creds[key]:
                val = encrypted_creds[key]
                if not val.startswith("gAAAA"): # Basic check to avoid double encryption if logic fails
                    encrypted_creds[key] = self.fernet.encrypt(val.encode()).decode()
                    
        return encrypted_creds

    def _decrypt_credentials(self, credentials: dict) -> dict:
        if not self.fernet or not credentials:
            return credentials
            
        sensitive_keys = ['client_secret', 'access_token', 'refresh_token', 'stripe_secret_key']
        decrypted_creds = credentials.copy()
        
        for key in sensitive_keys:
            if key in decrypted_creds and decrypted_creds[key]:
                val = decrypted_creds[key]
                # Fernet tokens start with gAAAA
                if isinstance(val, str) and val.startswith("gAAAA"):
                    try:
                        decrypted_creds[key] = self.fernet.decrypt(val.encode()).decode()
                    except Exception:
                        # Failed to decrypt (maybe key changed or data corrupted), return original
                        pass
                        
        return decrypted_creds

    async def get_active_providers(self, db: AsyncSession, reviewer_id: int) -> List[schemas.PaymentConfig]:
        result = await db.execute(
            select(models.PaymentConfig)
            .filter(
                models.PaymentConfig.reviewer_id == reviewer_id,
                models.PaymentConfig.is_enabled == True
            )
        )
        configs = result.scalars().all()
        # Decrypt credentials for usage
        for config in configs:
            if config.credentials:
                config.credentials = self._decrypt_credentials(config.credentials)
        return configs

    async def get_provider_config(self, db: AsyncSession, reviewer_id: int, provider: str) -> Optional[models.PaymentConfig]:
        result = await db.execute(
            select(models.PaymentConfig)
            .filter(
                models.PaymentConfig.reviewer_id == reviewer_id,
                models.PaymentConfig.provider == provider
            )
        )
        config = result.scalars().first()
        if config and config.credentials:
            config.credentials = self._decrypt_credentials(config.credentials)
        return config

    async def update_provider_config(self, db: AsyncSession, reviewer_id: int, provider: str, update: schemas.PaymentConfigUpdate) -> models.PaymentConfig:
        # Fetch existing config (raw, to avoid double decryption/encryption issues if we just updated partials)
        # Actually, get_provider_config decrypts. 
        # If we want to update, we should take the new credentials, merge with old (decrypted), 
        # and then encrypt the result before saving.
        
        config = await self.get_provider_config(db, reviewer_id, provider)
        
        if not config:
            # Create new config
            final_creds = update.credentials or {}
            encrypted_creds = self._encrypt_credentials(final_creds)
            
            config = models.PaymentConfig(
                reviewer_id=reviewer_id,
                provider=provider,
                is_enabled=update.is_enabled if update.is_enabled is not None else False,
                credentials=encrypted_creds
            )
            db.add(config)
        else:
            if update.is_enabled is not None:
                config.is_enabled = update.is_enabled
            if update.credentials is not None:
                # Merge credentials
                current_creds = config.credentials or {} # These are already decrypted by get_provider_config
                current_creds.update(update.credentials)
                
                # Encrypt before saving
                config.credentials = self._encrypt_credentials(current_creds)

        await db.commit()
        await db.refresh(config)
        
        # Return decrypted version for response
        if config.credentials:
             config.credentials = self._decrypt_credentials(config.credentials)
             
        return config

payment_service = PaymentService()
