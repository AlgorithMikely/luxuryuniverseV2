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
        print("Cogs loaded.")

async def main():
    """The main entrypoint for the bot."""
    intents = discord.Intents.default()
    intents.message_content = True  # Required for on_message event
    intents.reactions = True      # Required for on_reaction_add event

    bot = UniverseBot(command_prefix="!", intents=intents)

    @bot.command()
    @commands.is_owner()
    async def sync(ctx):
        """Syncs the slash commands with Discord."""
        try:
            synced = await bot.tree.sync()
            await ctx.send(f"Synced {len(synced)} commands.")
        except Exception as e:
            await ctx.send(f"Failed to sync commands: {e}")

    async with bot:
        await bot.start(settings.DISCORD_TOKEN)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot shut down.")
