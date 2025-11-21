from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator, field_validator
from typing import Optional, List

class Settings(BaseSettings):
    # By using SettingsConfigDict, we can specify that environment variables
    # which are lists of strings should be parsed by splitting on a comma.
    model_config = SettingsConfigDict(env_file=".env", env_separator=",", extra="ignore")

    # Core settings
    DISCORD_TOKEN: str = "your_discord_token_here"
    SECRET_KEY: str = "a_very_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ADMIN_DISCORD_IDS: List[str] = []

    @field_validator('ADMIN_DISCORD_IDS', mode='before')
    @classmethod
    def validate_admin_discord_ids(cls, v):
        if isinstance(v, str):
            # If it's a string, split by comma and strip whitespace
            return [id.strip() for id in v.split(',') if id.strip()]
        elif isinstance(v, int):
            # If it's a single integer, convert to string and wrap in list
            return [str(v)]
        elif isinstance(v, list):
            # If it's already a list, ensure all items are strings
            return [str(item) for item in v]
        return v

    # Database settings
    POSTGRES_SERVER: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "universe_bot"
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @model_validator(mode='after')
    def assemble_db_connection(self) -> 'Settings':
        if self.SQLALCHEMY_DATABASE_URI is None:
            self.SQLALCHEMY_DATABASE_URI = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:5432/{self.POSTGRES_DB}"
            )
        return self

    # Discord OAuth2 Settings
    DISCORD_CLIENT_ID: str
    DISCORD_CLIENT_SECRET: str
    DISCORD_REDIRECT_URI: str
    FRONTEND_URL: str = "http://localhost:5173"

    # Spotify API Settings
    SPOTIFY_CLIENT_ID: Optional[str] = None
    SPOTIFY_CLIENT_SECRET: Optional[str] = None
    SPOTIFY_REDIRECT_URI: str = "http://127.0.0.1:5173/api/spotify/callback"

    # Stripe Settings
    STRIPE_SECRET_KEY: Optional[str] = None

settings = Settings()
