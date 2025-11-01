import asyncio
import discord
from discord import app_commands
from discord.ext import commands
from services import user_service
from services.user_service import OwnerContextError
from typing import Callable, Any

class ModeratorCog(commands.Cog):
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

    moderator = app_commands.Group(name="moderator", description="Moderator management commands.")

    @moderator.command(name="add", description="Add a moderator to your reviewer profile.")
    @app_commands.guild_only()
    async def add_moderator(self, interaction: discord.Interaction, user: discord.User):
        await interaction.response.defer(ephemeral=True)
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to manage moderators here.")
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                moderator_user = user_service.get_or_create_user(db, str(user.id), user.name)
                return user_service.add_moderator(db, reviewer.id, moderator_user.id)

        success = await self._run_db_operation(db_call)
        if not success:
            await interaction.followup.send(f"{user.name} is already a moderator.")
            return
        await interaction.followup.send(f"{user.name} has been added as a moderator.")

    @moderator.command(name="remove", description="Remove a moderator from your reviewer profile.")
    @app_commands.guild_only()
    async def remove_moderator(self, interaction: discord.Interaction, user: discord.User):
        await interaction.response.defer(ephemeral=True)
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.followup.send("You are not authorized to manage moderators here.")
            return

        def db_call():
            with self.bot.SessionLocal() as db:
                moderator_user = user_service.get_user_by_discord_id(db, str(user.id))
                if not moderator_user:
                    return "not_moderator"
                return user_service.remove_moderator(db, reviewer.id, moderator_user.id)

        result = await self._run_db_operation(db_call)
        if result == "not_moderator":
            await interaction.followup.send(f"{user.name} is not a moderator.")
            return
        if not result:
            await interaction.followup.send(f"{user.name} is not a moderator for this reviewer.")
            return
        await interaction.followup.send(f"{user.name} has been removed as a moderator.")

async def setup(bot):
    await bot.add_cog(ModeratorCog(bot))
