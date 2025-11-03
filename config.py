from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from typing import Optional, List

class Settings(BaseSettings):
    # By using SettingsConfigDict, we can specify that environment variables
    # which are lists of strings should be parsed by splitting on a comma.
    model_config = SettingsConfigDict(env_file=".env", env_separator=",", extra="ignore")

    # Core settings
    DISCORD_TOKEN: str = "your_discord_token_here"
    SECRET_KEY: str = "a_very_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ADMIN_DISCORD_IDS: List[str] = []

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
                f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:5432/{self.POSTGRES_DB}"
            )
        return self

    # Discord OAuth2 Settings
    DISCORD_CLIENT_ID: str
    DISCORD_CLIENT_SECRET: str
    DISCORD_REDIRECT_URI: str
    FRONTEND_URL: str = "http://localhost:5173"

settings = Settings()
