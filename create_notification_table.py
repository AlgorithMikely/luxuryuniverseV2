import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Minimal logic to read .env
def load_env():
    env_vars = {}
    try:
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    except FileNotFoundError:
        print(".env file not found")
    return env_vars

async def run_migration():
    env = load_env()
    
    # Helper to get var from os.environ or loaded .env
    def get_var(key, default=None):
        return os.getenv(key) or env.get(key, default)
    
    # Construct DB URL
    postgres_user = get_var("POSTGRES_USER", "user")
    postgres_password = get_var("POSTGRES_PASSWORD", "password")
    postgres_server = get_var("POSTGRES_SERVER", "db")
    postgres_port = get_var("POSTGRES_PORT", "5432")
    postgres_db = get_var("POSTGRES_DB", "universe_bot")
    
    db_url = get_var("SQLALCHEMY_DATABASE_URI")
    if not db_url:
        db_url = f"postgresql+asyncpg://{postgres_user}:{postgres_password}@{postgres_server}:{postgres_port}/{postgres_db}"
    
    print(f"Connecting to: {db_url}")
    
    try:
        engine = create_async_engine(db_url)
        async with engine.begin() as conn:
            # Create notifications table
            # Check if using SQLite or Postgres for ID syntax
            if "sqlite" in db_url:
                id_col = "id INTEGER PRIMARY KEY AUTOINCREMENT"
                print("Using SQLite syntax")
            else:
                id_col = "id SERIAL PRIMARY KEY"
                print("Using Postgres syntax")

            await conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS notifications (
                    {id_col},
                    user_id INTEGER NOT NULL,
                    title VARCHAR NOT NULL,
                    message VARCHAR NOT NULL,
                    type VARCHAR DEFAULT 'info' NOT NULL,
                    link VARCHAR,
                    is_read BOOLEAN DEFAULT FALSE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            """))
            print("Migration successful: Created notifications table.")
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
