from pydantic import BaseModel, ConfigDict, Field
from typing import List

class UserBase(BaseModel):
    discord_id: str
    username: str
    avatar: str | None = None

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ReviewerProfile(BaseModel):
    id: int
    tiktok_handle: str | None = None
    discord_channel_id: str
    model_config = ConfigDict(from_attributes=True)

class UserProfile(User):
    reviewer_profile: ReviewerProfile | None = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    discord_id: str | None = None
    roles: List[str] = []

class Reviewer(BaseModel):
    id: int
    user: User
    model_config = ConfigDict(from_attributes=True)

class SubmissionReviewer(BaseModel):
    reviewer: Reviewer
    model_config = ConfigDict(from_attributes=True)

class Submission(BaseModel):
    id: int
    track_url: str
    status: str
    track_artist: str | None = None
    track_title: str | None = None
    is_spotlighted: bool
    is_bookmarked: bool
    submitted_by: User = Field(validation_alias='user')
    reviewers: List[SubmissionReviewer] = []
    model_config = ConfigDict(from_attributes=True)

class UserSubmissionsResponse(BaseModel):
    user: User
    submissions: List["Submission"]
    model_config = ConfigDict(from_attributes=True)

UserSubmissionsResponse.model_rebuild()
