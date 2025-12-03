import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Adding pending_coins to tiktok_accounts table...")
        try:
            await conn.execute(text("ALTER TABLE tiktok_accounts ADD COLUMN pending_coins INTEGER DEFAULT 0 NOT NULL"))
            print("Added pending_coins")
        except Exception as e:
            print(f"Skipping pending_coins (might already exist): {e}")
                
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
