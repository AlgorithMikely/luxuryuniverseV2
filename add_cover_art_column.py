import asyncio
import sys
import os
sys.path.append(os.getcwd())
from sqlalchemy import text
from database import async_engine

async def add_column():
    async with async_engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE submissions ADD COLUMN cover_art_url VARCHAR"))
            print("Successfully added cover_art_url column to submissions table.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column cover_art_url already exists.")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
