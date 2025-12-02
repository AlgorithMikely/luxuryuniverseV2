
import asyncio
import os
import discord
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = 1288939910530727968
USER_ID = 1288939094751051870 # aimlmusic

class MyClient(discord.Client):
    async def on_ready(self):
        print(f'Logged in as {self.user} (ID: {self.user.id})')
        guild = self.get_guild(GUILD_ID)
        if not guild:
            print(f"Guild {GUILD_ID} not found in cache. Fetching...")
            try:
                guild = await self.fetch_guild(GUILD_ID)
            except Exception as e:
                print(f"Failed to fetch guild: {e}")
                await self.close()
                return

        print(f"Guild found: {guild.name}")
        
        member = guild.get_member(USER_ID)
        if member:
            print(f"User {USER_ID} found in cache: {member.display_name}")
        else:
            print(f"User {USER_ID} not found in cache. Fetching...")
            try:
                member = await guild.fetch_member(USER_ID)
                print(f"User {USER_ID} fetched: {member.display_name}")
            except Exception as e:
                print(f"Failed to fetch member: {e}")
        
        await self.close()

intents = discord.Intents.default()
intents.members = True

client = MyClient(intents=intents)
client.run(TOKEN)
