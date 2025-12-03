import logging
from config import settings
try:
    import aioboto3
    from botocore.exceptions import ClientError
except ImportError:
    aioboto3 = None
    ClientError = None

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        if aioboto3:
            self.session = aioboto3.Session()
        else:
            self.session = None
            logger.warning("aioboto3 not installed. R2 storage will not work.")
            
        self.endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if settings.R2_ACCOUNT_ID else None
        
    async def upload_file(self, file_obj, filename: str, content_type: str = "application/octet-stream", bucket_name: str = None) -> str:
        if not self.session:
            raise ImportError("aioboto3 is not installed")
            
        if not self._check_config():
            raise Exception("R2 configuration is missing")
            
        target_bucket = bucket_name or settings.R2_BUCKET_NAME
        if not target_bucket:
             raise ValueError("No R2 bucket configured")

        try:
            from botocore.config import Config
            config = Config(signature_version='s3v4', region_name='auto')
            async with self.session.client("s3", 
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=config
            ) as s3:
                await s3.upload_fileobj(
                    file_obj, 
                    target_bucket, 
                    filename,
                    ExtraArgs={'ContentType': content_type}
                )
                return f"r2://{filename}"
        except Exception as e:
            logger.error(f"Failed to upload file to R2: {e}")
            raise

    async def generate_presigned_url(self, key: str, expiration: int = 3600) -> str:
        if not self.session:
            return None
            
        if not self._check_config():
            return None

        # Strip r2:// prefix if present
        if key.startswith("r2://"):
            key = key[5:]

        try:
            from botocore.config import Config
            config = Config(signature_version='s3v4', region_name='auto')
            async with self.session.client("s3", 
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=config
            ) as s3:
                url = await s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': settings.R2_BUCKET_NAME, 'Key': key},
                    ExpiresIn=expiration
                )
                return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None

    def _check_config(self) -> bool:
        return all([
            settings.R2_ACCOUNT_ID,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
            settings.R2_BUCKET_NAME
        ])

storage_service = StorageService()
