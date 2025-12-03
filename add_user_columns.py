import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Adding columns to users table...")
        
        columns = [
            "artist_name VARCHAR",
            "instagram_handle VARCHAR",
            "twitter_handle VARCHAR",
            "youtube_channel VARCHAR",
            "soundcloud_url VARCHAR",
            "apple_music_url VARCHAR"
        ]
        
        for col in columns:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col}"))
                print(f"Added {col}")
            except Exception as e:
                print(f"Skipping {col} (might already exist): {e}")
                
    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
