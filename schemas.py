from pydantic import BaseModel
from typing import List, Optional

class UserBase(BaseModel):
    discord_id: str
    username: str
    avatar: str | None = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str

    class Config:
        from_attributes = True

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None

# This schema represents the comprehensive user object returned on authentication,
# including the user's assigned roles.
class AuthenticatedUser(UserProfile):
    roles: List[str] = []

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    discord_id: str | None = None
    roles: List[str] = []

class Reviewer(BaseModel):
    id: int
    user: User

    class Config:
        from_attributes = True

class SubmissionReviewer(BaseModel):
    reviewer: Reviewer

    class Config:
        from_attributes = True

class SubmissionDetail(BaseModel):
    id: int
    track_url: str
    status: str
    artist: str | None = None
    title: str | None = None
    submission_count: int
    reviewers: List[SubmissionReviewer]

    class Config:
        from_attributes = True

class UserSubmissionsResponse(BaseModel):
    user: User
    submissions: List["SubmissionDetail"]

    class Config:
        from_attributes = True

UserSubmissionsResponse.model_rebuild()
