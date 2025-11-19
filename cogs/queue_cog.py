import discord
from discord import app_commands
from discord.ext import commands
from services import queue_service, user_service
from config import settings  # Import the settings object

def create_now_playing_embed(submission, user) -> discord.Embed:
    """Factory for creating the 'Now Playing' embed."""
    embed = discord.Embed(
        title="Now Playing",
        description=f"[{submission.track_title or submission.track_url}]({submission.track_url})",
        color=discord.Color.blue()
    )
    embed.set_footer(text=f"Submitted by {user.name}")
    if submission.notes:
        embed.add_field(name="Notes", value=submission.notes, inline=False)
    return embed

class QueueCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _get_reviewer_from_interaction(self, interaction: discord.Interaction):
        async with self.bot.SessionLocal() as db:
            # First, check if the user is an admin.
            # Convert admin discord ids from string to int for comparison
            admin_ids = [int(id) for id in settings.ADMIN_DISCORD_IDS]
            if interaction.user.id in admin_ids:
                # For admins, we need to determine the reviewer context from the channel
                reviewer = await queue_service.get_reviewer_by_channel_id(db, interaction.channel_id)
                return reviewer

            # If not an admin, check if they are a registered reviewer
            user = await user_service.get_user_by_discord_id(db, str(interaction.user.id))
            if not user:
                return None
            return await queue_service.get_reviewer_by_user_id(db, user.id)

    @app_commands.command(name="open", description="Open the submission queue.")
    @app_commands.guild_only()
    async def open_queue(self, interaction: discord.Interaction):
        async with self.bot.SessionLocal() as db:
            reviewer = None
            # Re-implement logic here because _get_reviewer closes the session
            admin_ids = [int(id) for id in settings.ADMIN_DISCORD_IDS]
            if interaction.user.id in admin_ids:
                reviewer = await queue_service.get_reviewer_by_channel_id(db, interaction.channel_id)
            else:
                user = await user_service.get_user_by_discord_id(db, str(interaction.user.id))
                if user:
                    reviewer = await queue_service.get_reviewer_by_user_id(db, user.id)

            if not reviewer:
                await interaction.response.send_message("You are not a reviewer.", ephemeral=True)
                return

            await queue_service.set_queue_status(db, reviewer.id, "open")
            await interaction.response.send_message("Queue is now open.", ephemeral=True)

    @app_commands.command(name="close", description="Close the submission queue.")
    @app_commands.guild_only()
    async def close_queue(self, interaction: discord.Interaction):
        async with self.bot.SessionLocal() as db:
            reviewer = None
            admin_ids = [int(id) for id in settings.ADMIN_DISCORD_IDS]
            if interaction.user.id in admin_ids:
                reviewer = await queue_service.get_reviewer_by_channel_id(db, interaction.channel_id)
            else:
                user = await user_service.get_user_by_discord_id(db, str(interaction.user.id))
                if user:
                    reviewer = await queue_service.get_reviewer_by_user_id(db, user.id)

            if not reviewer:
                await interaction.response.send_message("You are not a reviewer.", ephemeral=True)
                return

            await queue_service.set_queue_status(db, reviewer.id, "closed")
            await interaction.response.send_message("Queue is now closed.", ephemeral=True)

    @app_commands.command(name="next", description="Get the next track from the queue.")
    @app_commands.guild_only()
    async def next_track(self, interaction: discord.Interaction):
        async with self.bot.SessionLocal() as db:
            reviewer = None
            admin_ids = [int(id) for id in settings.ADMIN_DISCORD_IDS]
            if interaction.user.id in admin_ids:
                reviewer = await queue_service.get_reviewer_by_channel_id(db, interaction.channel_id)
            else:
                user = await user_service.get_user_by_discord_id(db, str(interaction.user.id))
                if user:
                    reviewer = await queue_service.get_reviewer_by_user_id(db, user.id)

            if not reviewer:
                await interaction.response.send_message("You are not a reviewer.", ephemeral=True)
                return

            submission = await queue_service.advance_queue(db, reviewer.id)
            if not submission:
                await interaction.response.send_message("The queue is empty.", ephemeral=True)
                return

            user = await self.bot.fetch_user(int(submission.user.discord_id))
            embed = create_now_playing_embed(submission, user)
            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="queue", description="View the current submission queue.")
    @app_commands.guild_only()
    async def view_queue(self, interaction: discord.Interaction):
        async with self.bot.SessionLocal() as db:
            reviewer = None
            admin_ids = [int(id) for id in settings.ADMIN_DISCORD_IDS]
            if interaction.user.id in admin_ids:
                reviewer = await queue_service.get_reviewer_by_channel_id(db, interaction.channel_id)
            else:
                user = await user_service.get_user_by_discord_id(db, str(interaction.user.id))
                if user:
                    reviewer = await queue_service.get_reviewer_by_user_id(db, user.id)

            if not reviewer:
                await interaction.response.send_message("You are not a reviewer.", ephemeral=True)
                return

            queue = await queue_service.get_pending_queue(db, reviewer.id)
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
