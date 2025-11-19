import asyncio
import discord
from discord.ext import commands
from sqlalchemy.orm import sessionmaker
import uvicorn
from fastapi import FastAPI

from config import settings
from database import AsyncSessionLocal, init_db
import bot_instance as bot_instance_module
from api_main import create_app

# Custom Bot class to hold the database session factory
class UniverseBot(commands.Bot):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.SessionLocal = AsyncSessionLocal
        self.api_app: FastAPI = create_app()
        self.api_server: uvicorn.Server | None = None

    async def setup_hook(self):
        # Initialize database tables
        print("Initializing database...")
        await init_db()
        print("Database initialized.")

        # This is called when the bot is preparing to start
        print("Loading cogs...")
        # In the future, this could auto-discover cogs
        await self.load_extension("cogs.submission_cog")
        await self.load_extension("cogs.queue_cog")
        await self.load_extension("cogs.economy_cog")
        await self.load_extension("cogs.user_cache_cog")
        await self.load_extension("cogs.channel_creator_cog")
        print("Cogs loaded.")

        # Start the FastAPI server as a background task
        config = uvicorn.Config(self.api_app, host="0.0.0.0", port=8000, log_level="info")
        self.api_server = uvicorn.Server(config)
        self.loop.create_task(self.api_server.serve())
        print("FastAPI server started.")

    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        print('Syncing slash commands...')
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} commands.")
        except Exception as e:
            print(f"Failed to sync commands: {e}")

        # Signal that the bot is ready
        print("Setting bot_ready event.")
        bot_instance_module.bot_ready.set()
        print("bot_ready event set.")

    async def close(self):
        if self.api_server:
            await self.api_server.shutdown()
        await super().close()

intents = discord.Intents.default()
intents.message_content = True  # Required for on_message event
intents.reactions = True      # Required for on_reaction_add event
intents.members = True        # Required for fetching all members

bot = UniverseBot(command_prefix="!", intents=intents)
bot_instance_module.bot = bot # Set the bot instance

async def main():
    """The main entrypoint for the bot."""
    async with bot:
        await bot.start(settings.DISCORD_TOKEN)

if __name__ == "__main__":
    asyncio.run(main())
