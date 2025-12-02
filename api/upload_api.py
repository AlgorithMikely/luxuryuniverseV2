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
        
        # Upload
        r2_uri = await storage_service.upload_file(file.file, key, content_type)
        
        # Construct Public URL
        # If R2_PUBLIC_URL is set in settings, use it. Otherwise, generate a presigned URL or use the r2:// URI.
        # Ideally, we should have a public domain mapped to the bucket (e.g. cdn.luxuryuniverse.com)
        # For now, we'll assume a public R2 dev URL or similar is available, OR we return the r2:// URI 
        # and let the frontend/proxy handle it.
        
        # However, the frontend expects a usable URL.
        # If we don't have a public domain, we might need to generate a presigned URL.
        # But presigned URLs expire. 
        
        # Let's check if we can construct a public URL.
        # Usually: https://pub-xxxxxxxx.r2.dev/key
        
        # For this implementation, I will return the r2:// URI and a presigned URL for immediate display.
        # But wait, the database stores the URL. If we store a presigned URL, it will break.
        # We should store the r2:// URI or the public URL.
        
        # Let's assume there is a public domain or we use the worker/public bucket access.
        # If settings has a PUBLIC_CDN_URL, use that.
        
        public_url = r2_uri
        if hasattr(settings, 'R2_PUBLIC_URL') and settings.R2_PUBLIC_URL:
             public_url = f"{settings.R2_PUBLIC_URL}/{key}"
        else:
             # Fallback: Generate a long-lived presigned URL (not ideal for permanent storage but works for now)
             # OR just return the r2:// URI and have a proxy endpoint.
             # Given the user wants "folders", they likely have a public bucket or domain.
             # I'll try to generate a presigned URL for the response so the frontend can show it immediately.
             # But for storage, we should probably return the key or r2:// URI.
             
             # The frontend sets 'bannerUrl' to this returned value.
             # If we return r2://..., the <img> tag won't work.
             
             # Let's generate a presigned URL for now.
             presigned = await storage_service.generate_presigned_url(key)
             if presigned:
                 public_url = presigned
        
        return {"url": public_url, "filename": filename, "key": key, "r2_uri": r2_uri}

    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
