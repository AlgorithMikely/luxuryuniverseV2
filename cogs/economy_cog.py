import discord
from discord import app_commands
from discord.ext import commands
from services import economy_service, queue_service, user_service

class EconomyCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_reaction_add(self, reaction: discord.Reaction, user: discord.User):
        if user.bot or not reaction.message.guild:
            return

        with self.bot.SessionLocal() as db:
            reviewer = queue_service.get_reviewer_by_channel_id(db, reaction.message.channel.id)
            if not reviewer:
                return

            # Don't award coins for reacting to your own message
            if reaction.message.author.id == user.id:
                return

            config = economy_service.get_economy_config(db, reviewer.id)
            # The emoji is hardcoded for now, as the current schema does not support
            # a configurable emoji trigger. The important part is that the amount is configurable.
            reaction_emoji = "👍"

            if str(reaction.emoji) == reaction_emoji:
                # The key 'reaction' corresponds to the 'event_name' in the EconomyConfig table.
                amount = config.get("reaction", 1)
                reacting_user = user_service.get_or_create_user(db, str(user.id), user.name)
                message_author = user_service.get_or_create_user(db, str(reaction.message.author.id), reaction.message.author.name)

                await economy_service.add_coins(
                    db,
                    reviewer_id=reviewer.id,
                    user_id=message_author.id,
                    amount=amount,
                    reason=f"Reaction from {reacting_user.username}"
                )

    @app_commands.command(name="balance", description="Check your coin balance.")
    @app_commands.guild_only()
    async def balance(self, interaction: discord.Interaction):
        with self.bot.SessionLocal() as db:
            reviewer = queue_service.get_reviewer_by_channel_id(db, interaction.channel.id)
            if not reviewer:
                await interaction.response.send_message("This is not a reviewer's channel.", ephemeral=True)
                return

            user = user_service.get_or_create_user(db, str(interaction.user.id), interaction.user.name)
            balance = economy_service.get_balance(db, reviewer.id, user.id)
            await interaction.response.send_message(f"You have {balance} Luxury Coins.", ephemeral=True)

async def setup(bot):
    await bot.add_cog(EconomyCog(bot))
