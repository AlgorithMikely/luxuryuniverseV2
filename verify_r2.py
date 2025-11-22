import asyncio
import io
import logging
from services.storage_service import storage_service
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify():
    print("--- R2 Verification ---")
    print(f"Account ID: {settings.R2_ACCOUNT_ID}")
    print(f"Bucket: {settings.R2_BUCKET_NAME}")
    
    if not settings.R2_ACCOUNT_ID or not settings.R2_BUCKET_NAME:
        print("❌ R2 Configuration missing!")
        return

    # 1. Test Upload
    print("\nTesting Upload...")
    try:
        content = b"Hello R2!"
        file_obj = io.BytesIO(content)
        filename = "test_upload.txt"
        
        url = await storage_service.upload_file(file_obj, filename, "text/plain")
        print(f"✅ Upload successful! URL: {url}")
        
        # 2. Test Presigned URL
        print("\nTesting Presigned URL...")
        presigned = await storage_service.generate_presigned_url(url)
        if presigned:
            print(f"✅ Presigned URL generated: {presigned}")
        else:
            print("❌ Failed to generate presigned URL")
            
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
