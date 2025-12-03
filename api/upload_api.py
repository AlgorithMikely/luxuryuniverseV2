from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
import uuid
import os
from config import settings
from services.storage_service import storage_service
from security import get_current_active_user as get_current_user
from models import User

router = APIRouter(prefix="/uploads", tags=["Uploads"])

@router.post("/stage")
async def stage_upload(
    file: UploadFile = File(...),
    category: str = Form("temp"),
    entity_id: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a file to Cloudflare R2 with a structured path.
    
    Args:
        file: The file to upload.
        category: The category of the upload (e.g., 'reviewer_banner', 'reviewer_avatar', 'user_avatar', 'submission_audio', 'submission_cover').
        entity_id: The ID of the entity (reviewer_id, user_id, submission_id). If not provided, defaults to current user's ID for user/reviewer categories.
    """
    try:
        if not storage_service.session:
             raise HTTPException(status_code=500, detail="Storage service not available (R2 not configured)")

        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{file_ext}"
        
        # Determine path based on category
        if category == "reviewer_banner":
            # If entity_id is not provided, try to use the current user's reviewer profile
            target_id = entity_id
            if not target_id and current_user.reviewer_profile:
                target_id = str(current_user.reviewer_profile.id)
            
            if not target_id:
                raise HTTPException(status_code=400, detail="Reviewer ID required for banner upload")
                
            key = f"reviewers/{target_id}/banner/{filename}"
            
        elif category == "reviewer_avatar":
            target_id = entity_id
            if not target_id and current_user.reviewer_profile:
                target_id = str(current_user.reviewer_profile.id)
                
            if not target_id:
                raise HTTPException(status_code=400, detail="Reviewer ID required for avatar upload")
                
            key = f"reviewers/{target_id}/avatar/{filename}"
            
        elif category == "user_avatar":
            target_id = entity_id or str(current_user.id)
            key = f"users/{target_id}/avatar/{filename}"
            
        elif category == "submission_audio":
            if not entity_id:
                 # If no submission ID yet (new submission), use a temp folder or a UUID
                 # For now, let's use a 'temp' folder and move it later, or just use the UUID as the folder
                 entity_id = str(uuid.uuid4())
            key = f"submissions/{entity_id}/audio/{filename}"
            
        elif category == "submission_cover":
             if not entity_id:
                 entity_id = str(uuid.uuid4())
             key = f"submissions/{entity_id}/cover/{filename}"
             
        else:
            # Default/Temp
            key = f"temp/{filename}"

        # Upload to R2
        # We need to reset the file pointer just in case
        await file.seek(0)
        
        # Determine content type
        content_type = file.content_type or "application/octet-stream"
        
        # Determine bucket and public URL base
        bucket_name = settings.R2_BUCKET_NAME
        public_url_base = None
        
        # Categories that go to the PUBLIC bucket
        if category in ["reviewer_banner", "reviewer_avatar", "user_avatar"]:
            if settings.R2_PUBLIC_BUCKET_NAME:
                bucket_name = settings.R2_PUBLIC_BUCKET_NAME
                public_url_base = settings.R2_PUBLIC_URL
        
        # Upload
        r2_uri = await storage_service.upload_file(file.file, key, content_type, bucket_name=bucket_name)
        
        # Construct Public URL
        public_url = r2_uri
        
        if public_url_base:
             # If we uploaded to the public bucket and have a public URL configured
             public_url = f"{public_url_base}/{key}"
             # IMPORTANT: For public bucket uploads, we want to save the PUBLIC URL, not the r2:// URI.
             # If we save r2://, the media_service will try to sign it against the PRIVATE bucket (default), which will 404.
             r2_uri = public_url
        elif hasattr(settings, 'R2_PUBLIC_URL') and settings.R2_PUBLIC_URL and bucket_name == settings.R2_PUBLIC_BUCKET_NAME:
             # Fallback if logic above missed it but we are in public bucket
             public_url = f"{settings.R2_PUBLIC_URL}/{key}"
             r2_uri = public_url
        else:
             # Private bucket or no public URL configured
             # Fallback: Generate a long-lived presigned URL (not ideal for permanent storage but works for now)
             presigned = await storage_service.generate_presigned_url(key)
             if presigned:
                 public_url = presigned
        
        return {"url": public_url, "filename": filename, "key": key, "r2_uri": r2_uri}

    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
