import discord
from discord import app_commands
from discord.ext import commands
from services import user_service
from services.user_service import OwnerContextError

class ModeratorCog(commands.Cog):
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

    moderator = app_commands.Group(name="moderator", description="Moderator management commands.")

    @moderator.command(name="add", description="Add a moderator to your reviewer profile.")
    @app_commands.guild_only()
    async def add_moderator(self, interaction: discord.Interaction, user: discord.User):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to manage moderators here.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            moderator_user = user_service.get_or_create_user(db, str(user.id), user.name)
            success = user_service.add_moderator(db, reviewer.id, moderator_user.id)
            if not success:
                await interaction.response.send_message(f"{user.name} is already a moderator.", ephemeral=True)
                return
            await interaction.response.send_message(f"{user.name} has been added as a moderator.", ephemeral=True)

    @moderator.command(name="remove", description="Remove a moderator from your reviewer profile.")
    @app_commands.guild_only()
    async def remove_moderator(self, interaction: discord.Interaction, user: discord.User):
        reviewer = await self._get_authorized_reviewer(interaction)
        if not reviewer:
            await interaction.response.send_message("You are not authorized to manage moderators here.", ephemeral=True)
            return

        with self.bot.SessionLocal() as db:
            moderator_user = user_service.get_user_by_discord_id(db, str(user.id))
            if not moderator_user:
                await interaction.response.send_message(f"{user.name} is not a moderator.", ephemeral=True)
                return

            success = user_service.remove_moderator(db, reviewer.id, moderator_user.id)
            if not success:
                await interaction.response.send_message(f"{user.name} is not a moderator.", ephemeral=True)
                return
            await interaction.response.send_message(f"{user.name} has been removed as a moderator.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(ModeratorCog(bot))
