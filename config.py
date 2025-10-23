from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dev.db"
    DISCORD_TOKEN: str = "your_discord_token_here"

    # JWT Settings
    SECRET_KEY: str = "a_very_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Discord OAuth2 Settings
    DISCORD_CLIENT_ID: str = "your_discord_client_id"
    DISCORD_CLIENT_SECRET: str = "your_discord_client_secret"
    DISCORD_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    FRONTEND_URL: str = "http://localhost:5173"


    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
