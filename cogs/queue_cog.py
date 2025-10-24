import discord
from discord import app_commands
from discord.ext import commands
from services import queue_service, user_service
from services.user_service import OwnerContextError

class QueueCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _get_authorized_reviewer(self, interaction: discord.Interaction):
        """Helper to get the authorized reviewer and handle common errors."""
        try:
            with self.bot.SessionLocal() as db:
                reviewer = user_service.get_authorized_reviewer(
                    db, str(interaction.user.id), str(interaction.channel.id)
                )
            return reviewer
        except OwnerContextError as e:
            await interaction.response.send_message(str(e), ephemeral=True)
            return None

    @app_commands.command(name="open", description="Open the submission queue.")
    @app_commands.guild_only()
    async def open_queue(self, interaction: discord.Interaction):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to manage this queue.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            queue_service.set_queue_status(db, reviewer.id, "open")
            await interaction.response.send_message("Queue is now open.", ephemeral=True)

    @app_commands.command(name="close", description="Close the submission queue.")
    @app_commands.guild_only()
    async def close_queue(self, interaction: discord.Interaction):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to manage this queue.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            queue_service.set_queue_status(db, reviewer.id, "closed")
            await interaction.response.send_message("Queue is now closed.", ephemeral=True)

    @app_commands.command(name="next", description="Get the next track from the queue.")
    @app_commands.guild_only()
    async def next_track(self, interaction: discord.Interaction):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to manage this queue.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            submission = await queue_service.advance_queue(db, reviewer.id)
            if not submission:
                await interaction.response.send_message("The queue is empty.", ephemeral=True)
                return

            user = await self.bot.fetch_user(int(submission.user.discord_id))
            embed = discord.Embed(
                title="Now Playing",
                description=f"[{submission.track_url}]({submission.track_url})",
                color=discord.Color.blue()
            )
            embed.set_footer(text=f"Submitted by {user.name}")
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="queue", description="View the current submission queue.")
    @app_commands.guild_only()
    async def view_queue(self, interaction: discord.Interaction):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to view this queue.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            queue = queue_service.get_pending_queue(db, reviewer.id)
            if not queue:
                await interaction.response.send_message("The queue is empty.", ephemeral=True)
                return

            embed = discord.Embed(title="Submission Queue", color=discord.Color.purple())
            for i, submission in enumerate(queue[:10]):
                user = await self.bot.fetch_user(int(submission.user.discord_id))
                embed.add_field(name=f"{i+1}. {user.name}", value=submission.track_url, inline=False)

            await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(QueueCog(bot))
