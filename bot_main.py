import asyncio
import discord
from discord.ext import commands
from sqlalchemy.orm import sessionmaker

from config import settings
from database import SessionLocal

# Custom Bot class to hold the database session factory
class UniverseBot(commands.Bot):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.SessionLocal: sessionmaker = SessionLocal

    async def setup_hook(self):
        # This is called when the bot is preparing to start
        print("Loading cogs...")
        # In the future, this could auto-discover cogs
        await self.load_extension("cogs.submission_cog")
        await self.load_extension("cogs.queue_cog")
        await self.load_extension("cogs.economy_cog")
        await self.load_extension("cogs.user_cache_cog")
        await self.load_extension("cogs.channel_creator_cog")
        print("Cogs loaded.")

    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        print('Syncing slash commands...')
        try:
            synced = await self.tree.sync()
            print(f"Synced {len(synced)} commands.")
        except Exception as e:
            print(f"Failed to sync commands: {e}")

async def main():
    """The main entrypoint for the bot."""
    intents = discord.Intents.default()
    intents.message_content = True  # Required for on_message event
    intents.reactions = True      # Required for on_reaction_add event

    bot = UniverseBot(command_prefix="!", intents=intents)

    async with bot:
        await bot.start(settings.DISCORD_TOKEN)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot shut down.")
