import asyncio
import discord
from discord import app_commands, Permissions
from discord.ext import commands
from services import user_service
from typing import Callable, Any

class ReviewerCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def _run_db_operation(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """Helper to run synchronous database operations in a separate thread."""
        return await asyncio.to_thread(func, *args, **kwargs)

    @app_commands.command(name="add_reviewer", description="Set up a new reviewer with dedicated channels.")
    @app_commands.describe(
        user="The Discord user to designate as the reviewer.",
        tiktok_handle="The reviewer's TikTok handle, used for the category name."
    )
    @app_commands.guild_only()
    async def add_reviewer(self, interaction: discord.Interaction, user: discord.Member, tiktok_handle: str):
        await interaction.response.defer(ephemeral=True)

        # Admin-only check
        if str(interaction.user.id) not in self.bot.settings.ADMIN_DISCORD_IDS:
            await interaction.followup.send("You are not authorized to use this command.")
            return

        guild = interaction.guild

        # Create a new role for the reviewer
        reviewer_role = await guild.create_role(name=f"{tiktok_handle} Reviewer")
        await user.add_roles(reviewer_role)

        # Create a category for the reviewer's channels
        category = await guild.create_category(tiktok_handle)

        # Set up permissions
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False, send_messages=False),
            reviewer_role: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            user: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True)
        }

        submission_overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            reviewer_role: discord.PermissionOverwrite(read_messages=True, send_messages=True),
        }

        # Create channels
        submission_channel = await category.create_text_channel("submissions", overwrites=submission_overwrites)
        queue_channel = await category.create_text_channel("queue", overwrites=overwrites)

        def db_call():
            with self.bot.SessionLocal() as db:
                db_user = user_service.get_or_create_user(db, str(user.id), user.name)
                return user_service.create_reviewer(
                    db,
                    db_user.id,
                    submission_channel_id=str(submission_channel.id),
                    queue_channel_id=str(queue_channel.id),
                    reviewer_role_id=str(reviewer_role.id)
                )

        reviewer = await self._run_db_operation(db_call)
        if not reviewer:
            await interaction.followup.send("This user is already a reviewer.")
            # Clean up created channels and role if the user already exists
            await submission_channel.delete()
            await queue_channel.delete()
            await category.delete()
            await reviewer_role.delete()
            return

        await submission_channel.send(
            f"Welcome, {user.mention}! This is now your submission queue. "
            f"Your community can submit tracks here. Use the `/open` command in the `#{queue_channel.name}` channel to begin."
        )
        await interaction.followup.send(f"Reviewer {user.name} has been set up with the category `{tiktok_handle}`.")

async def setup(bot):
    await bot.add_cog(ReviewerCog(bot))
