from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid
from config import settings

router = APIRouter(prefix="/uploads", tags=["Uploads"])

UPLOAD_DIR = "uploads/staging"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/stage")
async def stage_upload(file: UploadFile = File(...)):
    try:
        # Generate unique filename
        file_ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return public URL
        # Assuming we serve uploads via static mount
        url = f"{settings.API_URL}/api/uploads/staging/{filename}"
        return {"url": url, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
