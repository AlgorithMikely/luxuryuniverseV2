import discord
from discord import app_commands
from discord.ext import commands, tasks
import logging
from sqlalchemy import select
from sqlalchemy.orm import joinedload
import models
from config import settings

logger = logging.getLogger(__name__)

class GamificationCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.sync_roles_task.start()

    def cog_unload(self):
        self.sync_roles_task.cancel()

    # Custom check for app commands
    def is_admin_check(self, interaction: discord.Interaction) -> bool:
        return str(interaction.user.id) in settings.ADMIN_DISCORD_IDS

    # Group for slash commands
    gamification_group = app_commands.Group(name="gamification", description="Gamification management commands")

    @gamification_group.command(name="setup_roles", description="Creates or updates Discord roles for all achievements (Admin only)")
    async def setup_roles(self, interaction: discord.Interaction):
        """
        Creates or updates Discord roles for all achievements.
        Applies colors and icons from the database.
        """
        if not self.is_admin_check(interaction):
            await interaction.response.send_message("You are not authorized to use this command.", ephemeral=True)
            return

        await interaction.response.send_message("Setting up achievement roles... This might take a moment.", ephemeral=True)

        async with self.bot.SessionLocal() as db:
            # Fetch all definitions
            stmt = select(models.AchievementDefinition)
            result = await db.execute(stmt)
            definitions = result.scalars().all()

            updated_count = 0
            created_count = 0
            guild = interaction.guild

            if not guild:
                await interaction.followup.send("This command must be run in a server.")
                return

            for ach in definitions:
                color = discord.Colour.default()
                if ach.role_color:
                    try:
                        color = discord.Colour.from_str(ach.role_color)
                    except:
                        logger.warning(f"Invalid color for {ach.display_name}: {ach.role_color}")

                # Role Icon
                display_icon = ach.role_icon

                role = None
                if ach.discord_role_id:
                    # Try to find by ID first
                    role = guild.get_role(int(ach.discord_role_id))

                if not role:
                    # Try to find by name to avoid duplicates
                    role = discord.utils.get(guild.roles, name=ach.display_name)

                if role:
                    # Update existing role
                    try:
                        changes = {}
                        if role.color != color:
                            changes["colour"] = color

                        # Note: display_icon update depends on server boost level, but we attempt it.
                        # discord.py handles this gracefully usually.
                        if display_icon:
                             changes["display_icon"] = display_icon

                        if changes:
                            await role.edit(**changes, reason="Gamification Update")
                            updated_count += 1
                    except discord.Forbidden:
                        logger.error(f"Permission denied editing role {role.name}")
                    except Exception as e:
                        logger.error(f"Error editing role {role.name}: {e}")

                    # Ensure DB has ID
                    if not ach.discord_role_id:
                        ach.discord_role_id = str(role.id)

                else:
                    # Create new role
                    try:
                        role = await guild.create_role(
                            name=ach.display_name,
                            colour=color,
                            display_icon=display_icon,
                            reason="Gamification Setup"
                        )
                        logger.info(f"Created role for {ach.display_name}: {role.id}")
                        ach.discord_role_id = str(role.id)
                        created_count += 1
                    except discord.Forbidden:
                        await interaction.followup.send(f"Error: I don't have permission to manage roles. Failed at {ach.display_name}")
                        return
                    except Exception as e:
                        logger.error(f"Failed to create role {ach.display_name}: {e}")
                        continue

            await db.commit()
            await interaction.followup.send(f"Setup complete. Created {created_count}, Updated {updated_count} roles.")

    @gamification_group.command(name="nuke_roles", description="Deletes all Discord roles created by the gamification system (Admin only)")
    async def nuke_roles(self, interaction: discord.Interaction):
        """
        Deletes all Discord roles created by the gamification system.
        """
        if not self.is_admin_check(interaction):
            await interaction.response.send_message("You are not authorized to use this command.", ephemeral=True)
            return

        await interaction.response.send_message("⚠️ Nuking gamification roles... This cannot be undone.", ephemeral=True)

        async with self.bot.SessionLocal() as db:
            stmt = select(models.AchievementDefinition).filter(models.AchievementDefinition.discord_role_id.isnot(None))
            result = await db.execute(stmt)
            definitions = result.scalars().all()

            deleted_count = 0
            guild = interaction.guild

            if not guild:
                await interaction.followup.send("This command must be run in a server.")
                return

            for ach in definitions:
                role_id = int(ach.discord_role_id)
                role = guild.get_role(role_id)

                if role:
                    try:
                        await role.delete(reason="Gamification Nuke Command")
                        logger.info(f"Deleted role {role.name} ({role.id})")
                    except discord.Forbidden:
                        logger.error(f"Permission denied deleting role {role_id}")
                        # Don't stop nuking, try others
                    except Exception as e:
                        logger.error(f"Error deleting role {role_id}: {e}")
                else:
                    logger.warning(f"Role {role_id} not found in guild, cleaning DB.")

                # Clear from DB regardless of whether it was found in Discord
                ach.discord_role_id = None
                deleted_count += 1

            await db.commit()
            await interaction.followup.send(f"Nuke complete. Removed {deleted_count} roles from the system.")

    @tasks.loop(seconds=60)
    async def sync_roles_task(self):
        """
        Background task to sync pending achievements to Discord roles.
        """
        try:
            async with self.bot.SessionLocal() as db:
                # Fetch pending user achievements
                stmt = select(models.UserAchievement)\
                    .options(joinedload(models.UserAchievement.user), joinedload(models.UserAchievement.achievement))\
                    .filter(models.UserAchievement.discord_sync_status == "PENDING")
                result = await db.execute(stmt)
                pending = result.scalars().all()

                if not pending:
                    return

                for ua in pending:
                    user = ua.user
                    achievement = ua.achievement

                    if not user:
                        logger.warning(f"UserAchievement {ua.id} has no associated user. Skipping.")
                        continue

                    if not user.discord_id or not achievement.discord_role_id:
                        # Cannot sync yet
                        continue

                    guild_id = None
                    member = None
                    role = None

                    # Try to find member in connected guilds
                    for guild in self.bot.guilds:
                        member = guild.get_member(int(user.discord_id))
                        if member:
                            role = guild.get_role(int(achievement.discord_role_id))
                            if role:
                                break

                    if member and role:
                        try:
                            if role not in member.roles:
                                await member.add_roles(role, reason=f"Unlocked achievement: {achievement.display_name}")
                                logger.info(f"Assigned role {role.name} to {user.username}")

                            ua.discord_sync_status = "SYNCED"
                        except discord.Forbidden:
                            logger.error(f"Missing permissions to assign role {role.name}")
                            ua.discord_sync_status = "FAILED_PERMS"
                        except Exception as e:
                            logger.error(f"Error assigning role: {e}")
                            ua.discord_sync_status = "FAILED"
                    else:
                        # Member left server or role deleted?
                        if not member:
                            # logger.warning(f"User {user.username} not found in any guild.")
                            pass # Silent fail for now until they rejoin
                        if not role:
                            logger.warning(f"Role {achievement.discord_role_id} not found.")
                            ua.discord_sync_status = "FAILED_ROLE_MISSING"

                await db.commit()

        except Exception as e:
            logger.error(f"Error in sync_roles_task: {e}")

    @sync_roles_task.before_loop
    async def before_sync_roles_task(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(GamificationCog(bot))
