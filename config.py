from pydantic_settings import BaseSettings
from pydantic import model_validator, field_validator
from typing import Optional, Dict, Any, List

class Settings(BaseSettings):
    ADMIN_DISCORD_IDS: List[str] = []

    @field_validator('ADMIN_DISCORD_IDS', mode='before')
    def split_string(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return [id.strip() for id in v.split(',')]
        if isinstance(v, (int, float)):
             return [str(v)]
        if isinstance(v, list):
            return v
        return []
    # Core settings
    DISCORD_TOKEN: str = "your_discord_token_here"
    SECRET_KEY: str = "a_very_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "universe_bot"
    SQLALCHEMY_DATABASE_URI: Optional[str] = None

    @model_validator(mode='before')
    def assemble_db_connection(cls, v: Any) -> Dict[str, Any]:
        if isinstance(v, dict):
            # Forcibly use the correct internal Docker host and port.
            # This ensures the backend can always connect to the db container.
            v['SQLALCHEMY_DATABASE_URI'] = (
                f"postgresql://{v.get('POSTGRES_USER', 'user')}:{v.get('POSTGRES_PASSWORD', 'password')}"
                f"@db:5432/{v.get('POSTGRES_DB', 'universe_bot')}"
            )
        return v

    # Discord OAuth2 Settings
    DISCORD_CLIENT_ID: str
    DISCORD_CLIENT_SECRET: str
    DISCORD_REDIRECT_URI: str
    FRONTEND_URL: str = "http://localhost:5173"


    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
