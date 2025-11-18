import os

# Set env vars BEFORE importing config/database so pydantic picks them up
os.environ["POSTGRES_SERVER"] = "localhost"
os.environ["POSTGRES_PORT"] = "6543"

from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).all()
print(f"Found {len(users)} users.")
for user in users:
    print(f"User: {user.username} (ID: {user.discord_id})")
    print(f"  Spotify Refresh Token: {'SET' if user.spotify_refresh_token else 'NOT SET'}")
    print(f"  Spotify Access Token: {'SET' if user.spotify_access_token else 'NOT SET'}")
db.close()
