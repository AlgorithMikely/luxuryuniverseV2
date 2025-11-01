import asyncio
import discord
from discord import app_commands
from discord.ext import commands
from services import queue_service, user_service
from services.user_service import OwnerContextError
from typing import Callable, Any

class QueueCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _run_db_operation(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """Helper to run synchronous database operations in a separate thread."""
        return await asyncio.to_thread(func, *args, **kwargs)

    async def _get_authorized_reviewer(self, interaction: discord.Interaction):
        """Helper to get the authorized reviewer and handle common errors."""
        try:
            def db_call():
                with self.bot.SessionLocal() as db:
                    return user_service.get_authorized_reviewer(
                        db, str(interaction.user.id), str(interaction.channel.id)
                    )
            reviewer = await self._run_db_operation(db_call)
            return reviewer
        except OwnerContextError as e:
            await interaction.response.send_message(str(e), ephemeral=True)
            return None

    @app_commands.command(name="open", description="Open the submission queue.")
    @app_commands.guild_only()
    async def open_queue(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to manage this queue.")
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                return queue_service.set_queue_status(db, reviewer.id, "open")

        await self._run_db_operation(db_call)
        await interaction.followup.send("Queue is now open.")

    @app_commands.command(name="close", description="Close the submission queue.")
    @app_commands.guild_only()
    async def close_queue(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to manage this queue.")
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                return queue_service.set_queue_status(db, reviewer.id, "closed")

        await self._run_db_operation(db_call)
        await interaction.followup.send("Queue is now closed.")

    @app_commands.command(name="next", description="Get the next track from the queue.")
    @app_commands.guild_only()
    async def next_track(self, interaction: discord.Interaction):
        await interaction.response.defer()
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to manage this queue.", ephemeral=True)
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                return queue_service.advance_queue_and_get_user(db, reviewer.id)

        result = await self._run_db_operation(db_call)
        if not result:
            await interaction.followup.send("The queue is empty.", ephemeral=True)
            return

        submission, discord_id = result
        user = await self.bot.fetch_user(int(discord_id))
        embed = discord.Embed(
            title="Now Playing",
            description=f"[{submission.track_url}]({submission.track_url})",
            color=discord.Color.blue()
        )
        embed.set_footer(text=f"Submitted by {user.name}")

        queue_channel = self.bot.get_channel(int(reviewer.queue_channel_id))
        if queue_channel:
            await queue_channel.send(embed=embed)

        await interaction.followup.send("Next track announced in the queue channel.", ephemeral=True)

    @app_commands.command(name="queue", description="View the current submission queue.")
    @app_commands.guild_only()
    async def view_queue(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to view this queue.")
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                return queue_service.get_pending_queue_with_users(db, reviewer.id)

        queue_with_users = await self._run_db_operation(db_call)
        if not queue_with_users:
            await interaction.followup.send("The queue is empty.")
            return

        embed = discord.Embed(title="Submission Queue", color=discord.Color.purple())
        for i, (submission, discord_id) in enumerate(queue_with_users[:10]):
            user = await self.bot.fetch_user(int(discord_id))
            embed.add_field(name=f"{i+1}. {user.name}", value=submission.track_url, inline=False)

        await interaction.followup.send(embed=embed)

async def setup(bot):
    await bot.add_cog(QueueCog(bot))
