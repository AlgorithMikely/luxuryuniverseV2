import models
import schemas
from services.storage_service import storage_service
import logging

logger = logging.getLogger(__name__)

async def enrich_reviewer_profile(reviewer: models.Reviewer) -> schemas.ReviewerProfile:
    """
    Converts a SQLAlchemy Reviewer model to a Pydantic ReviewerProfile,
    enriching any r2:// URIs with fresh presigned URLs.
    """
    if not reviewer:
        return None

    # Convert to Pydantic model first to avoid modifying the DB session object
    # We use model_validate to ensure all fields are correctly mapped
    profile = schemas.ReviewerProfile.model_validate(reviewer)

    # 1. Enrich Avatar URL
    if profile.avatar_url and profile.avatar_url.startswith("r2://"):
        profile.avatar_r2_uri = profile.avatar_url  # Store original URI
        try:
            presigned = await storage_service.generate_presigned_url(profile.avatar_url)
            if presigned:
                profile.avatar_url = presigned
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for avatar {profile.avatar_url}: {e}")

    # 2. Enrich Banner URL (in configuration)
    if profile.configuration and profile.configuration.banner_url:
        banner_url = profile.configuration.banner_url
        if banner_url.startswith("r2://"):
            profile.configuration.banner_r2_uri = banner_url # Store original URI
            try:
                presigned = await storage_service.generate_presigned_url(banner_url)
                if presigned:
                    # We need to update the configuration object. 
                    # Since configuration is a Pydantic model nested in ReviewerProfile, we can modify it directly.
                    profile.configuration.banner_url = presigned
            except Exception as e:
                logger.error(f"Failed to generate presigned URL for banner {banner_url}: {e}")

    return profile
