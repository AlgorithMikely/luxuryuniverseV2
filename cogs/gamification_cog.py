import discord
from discord.ext import commands, tasks
import logging
from sqlalchemy import select, update
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

    async def is_admin(self, ctx_or_interaction):
        """Checks if the user is an admin."""
        user_id = None
        if isinstance(ctx_or_interaction, discord.Interaction):
            user_id = ctx_or_interaction.user.id
        else:
            user_id = ctx_or_interaction.author.id

        if str(user_id) in settings.ADMIN_DISCORD_IDS:
            return True
        return False

    @commands.group(name="gamification", invoke_without_command=True)
    async def gamification_group(self, ctx):
        if not await self.is_admin(ctx):
            await ctx.send("You are not authorized to use this command.")
            return
        await ctx.send("Available commands: `setup_roles`, `nuke_roles`")

    @gamification_group.command(name="setup_roles")
    async def setup_roles(self, ctx):
        """
        Creates Discord roles for all achievements that don't have one yet.
        """
        if not await self.is_admin(ctx):
            await ctx.send("You are not authorized to use this command.")
            return

        await ctx.send("Setting up achievement roles... This might take a moment.")

        async with self.bot.SessionLocal() as db:
            # Fetch all definitions
            stmt = select(models.AchievementDefinition)
            result = await db.execute(stmt)
            definitions = result.scalars().all()

            created_count = 0
            guild = ctx.guild

            for ach in definitions:
                if not ach.discord_role_id:
                    # Check if role exists by name first to avoid duplicates if DB was wiped but Guild wasn't
                    existing_role = discord.utils.get(guild.roles, name=ach.display_name)

                    role = None
                    if existing_role:
                        role = existing_role
                        logger.info(f"Found existing role for {ach.display_name}: {role.id}")
                    else:
                        try:
                            role = await guild.create_role(name=ach.display_name, reason="Gamification Setup")
                            logger.info(f"Created role for {ach.display_name}: {role.id}")
                        except discord.Forbidden:
                            await ctx.send("Error: I don't have permission to manage roles.")
                            return
                        except Exception as e:
                            logger.error(f"Failed to create role {ach.display_name}: {e}")
                            continue

                    # Update DB
                    if role:
                        ach.discord_role_id = str(role.id)
                        created_count += 1

            await db.commit()
            await ctx.send(f"Setup complete. Linked {created_count} roles.")

    @gamification_group.command(name="nuke_roles")
    async def nuke_roles(self, ctx):
        """
        Deletes all Discord roles created by the gamification system.
        """
        if not await self.is_admin(ctx):
            await ctx.send("You are not authorized to use this command.")
            return

        await ctx.send("⚠️ nuking gamification roles... This cannot be undone.")

        async with self.bot.SessionLocal() as db:
            stmt = select(models.AchievementDefinition).filter(models.AchievementDefinition.discord_role_id.isnot(None))
            result = await db.execute(stmt)
            definitions = result.scalars().all()

            deleted_count = 0
            guild = ctx.guild

            for ach in definitions:
                role_id = int(ach.discord_role_id)
                role = guild.get_role(role_id)

                if role:
                    try:
                        await role.delete(reason="Gamification Nuke Command")
                        logger.info(f"Deleted role {role.name} ({role.id})")
                    except discord.Forbidden:
                        logger.error(f"Permission denied deleting role {role_id}")
                    except Exception as e:
                        logger.error(f"Error deleting role {role_id}: {e}")
                else:
                    logger.warning(f"Role {role_id} not found in guild, cleaning DB.")

                # Clear from DB regardless of whether it was found in Discord
                ach.discord_role_id = None
                deleted_count += 1

            await db.commit()
            await ctx.send(f"Nuke complete. Removed {deleted_count} roles from the system.")

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

                    if not user.discord_id or not achievement.discord_role_id:
                        # Cannot sync yet
                        continue

                    guild_id = None
                    # We assume the bot operates in one main guild or we need to know which guild
                    # For V1, let's iterate through bot.guilds and try to find the member
                    member = None
                    role = None

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
                            logger.warning(f"User {user.username} not found in any guild.")
                        if not role:
                            logger.warning(f"Role {achievement.discord_role_id} not found.")
                        # Keep pending to retry? Or fail?
                        # Let's keep PENDING if member missing (might join later), but fail if role missing
                        if not role:
                             ua.discord_sync_status = "FAILED_ROLE_MISSING"

                await db.commit()

        except Exception as e:
            logger.error(f"Error in sync_roles_task: {e}")

    @sync_roles_task.before_loop
    async def before_sync_roles_task(self):
        await self.bot.wait_until_ready()

async def setup(bot):
    await bot.add_cog(GamificationCog(bot))
