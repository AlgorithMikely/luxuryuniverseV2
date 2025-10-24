import discord
from discord import app_commands
from discord.ext import commands
from services import user_service

class ReviewerCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="add_reviewer", description="Add a new reviewer.")
    @app_commands.guild_only()
    @app_commands.checks.is_owner()
    async def add_reviewer(self, interaction: discord.Interaction, user: discord.User, submission_channel: discord.TextChannel, queue_channel: discord.TextChannel, reviewer_role: discord.Role):
        with self.bot.SessionLocal() as db:
            db_user = user_service.get_or_create_user(db, str(user.id), user.name)
            reviewer = user_service.create_reviewer(
                db,
                db_user.id,
                submission_channel_id=str(submission_channel.id),
                queue_channel_id=str(queue_channel.id),
                reviewer_role_id=str(reviewer_role.id)
            )
            if not reviewer:
                await interaction.response.send_message("This user is already a reviewer.", ephemeral=True)
                return

            await submission_channel.send(
                f"Welcome, {user.mention}! This channel is now your submission queue. "
                f"Use the `/open` command to start accepting submissions."
            )
            await interaction.response.send_message(f"Reviewer {user.name} has been added.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(ReviewerCog(bot))
