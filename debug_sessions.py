import os
import asyncio
import sys

# Import config first to patch settings
try:
    import config
except ImportError:
    # Add current directory to path if needed
    sys.path.append(os.getcwd())
    import config

# Patch the database URI
# Original: postgresql+asyncpg://user:password@db:5432/universe_bot
# Target:   postgresql+asyncpg://user:password@localhost:6543/universe_bot

original_uri = str(config.settings.SQLALCHEMY_DATABASE_URI)
print(f"Original URI (masked): {original_uri.replace(config.settings.POSTGRES_PASSWORD, '******')}")

# Replace host and port
# Note: config.py hardcodes port 5432 in the f-string
patched_uri = original_uri.replace("@db:5432", "@localhost:6543")

# If the original URI used localhost (e.g. from env var override attempt), handle that too
patched_uri = patched_uri.replace("@localhost:5432", "@localhost:6543")

config.settings.SQLALCHEMY_DATABASE_URI = patched_uri
print(f"Patched URI (masked): {patched_uri.replace(config.settings.POSTGRES_PASSWORD, '******')}")

# Now import database, which uses config.settings
from database import AsyncSessionLocal
import models
from sqlalchemy import select

async def list_sessions():
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(models.ReviewSession))
            sessions = result.scalars().all()
            
            print(f"\n{'ID':<5} {'Reviewer ID':<12} {'Active':<8} {'Name'}")
            print("-" * 60)
            for session in sessions:
                print(f"{session.id:<5} {session.reviewer_id:<12} {str(session.is_active):<8} {session.name}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(list_sessions())
