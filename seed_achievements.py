import asyncio
import uuid
import logging
from sqlalchemy import select
from database import AsyncSessionLocal
from models import AchievementDefinition

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_achievements():
    async with AsyncSessionLocal() as db:
        definitions = []

        # --- CLEANUP OBSOLETE ACHIEVEMENTS ---
        obsolete_slugs = ["server_pillar", "founder"]
        for slug in obsolete_slugs:
            result = await db.execute(select(AchievementDefinition).filter_by(slug=slug))
            achievement = result.scalar_one_or_none()
            if achievement:
                logger.info(f"Removing obsolete achievement: {slug}")
                await db.delete(achievement)

        # --- EXISTING REVIEWER TRACK (Preserved) ---
        definitions.extend([
            {
                "slug": "opener",
                "display_name": "The Opener",
                "description": "Reach 1,000 Total Likes on your stream.",
                "category": "LIFETIME_LIKES",
                "threshold_value": 1000,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#57F287",
                "role_icon": "🌱"
            },
            {
                "slug": "headliner",
                "display_name": "Headliner",
                "description": "Reach 100,000 Total Likes on your stream.",
                "category": "LIFETIME_LIKES",
                "threshold_value": 100000,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#F1C40F",
                "role_icon": "🌟"
            },
            {
                "slug": "sold_out",
                "display_name": "Sold Out",
                "description": "Reach 100 Concurrent Viewers.",
                "category": "CONCURRENT_VIEWERS",
                "threshold_value": 100,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#9B59B6",
                "role_icon": "🎫"
            },
            {
                "slug": "label_exec",
                "display_name": "Label Exec",
                "description": "Earn 5,000 Diamonds (Gift Value).",
                "category": "LIFETIME_DIAMONDS",
                "threshold_value": 5000,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#1ABC9C",
                "role_icon": "💎"
            }
        ])

        # --- CATEGORY A: THE ARTIST (Music Submissions) ---
        definitions.extend([
            {
                "slug": "demo_tape",
                "display_name": "Demo Tape",
                "description": "Submit your first track to the queue.",
                "category": "SUBMISSION_COUNT",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#B9BBBE",
                "role_icon": "📼"
            },
            {
                "slug": "producer_tag",
                "display_name": "Producer Tag",
                "description": "Submit a track with '(Prod.' in the title.",
                "category": "METADATA_TAG",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🎹"
            },
            {
                "slug": "collaborator",
                "display_name": "Collaborator",
                "description": "Submit a track with 'feat.' in the title.",
                "category": "METADATA_TAG",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🤝"
            },
            {
                "slug": "soundcloud_rapper",
                "display_name": "SoundCloud Rapper",
                "description": "Submit a SoundCloud link.",
                "category": "LINK_TYPE",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "☁️"
            },
            {
                "slug": "dsp_pro",
                "display_name": "DSP Pro",
                "description": "Submit a Spotify or Apple Music link.",
                "category": "LINK_TYPE",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🎵"
            },
            {
                "slug": "ep_release",
                "display_name": "EP Release",
                "description": "Submit a total of 10 tracks.",
                "category": "SUBMISSION_COUNT",
                "threshold_value": 10,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#3498DB",
                "role_icon": "💿"
            },
            {
                "slug": "genre_bender",
                "display_name": "Genre Bender",
                "description": "Submit tracks with 5 different genre tags.",
                "category": "GENRE_COUNT",
                "threshold_value": 5,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🎨"
            },
            {
                "slug": "certified_gold",
                "display_name": "Certified Gold",
                "description": "Get a 'W' (Win) on 3 consecutive submissions.",
                "category": "WIN_STREAK",
                "threshold_value": 3,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#F1C40F",
                "role_icon": "📀"
            },
            {
                "slug": "crowd_fav",
                "display_name": "Crowd Fav",
                "description": "Achieve >90% 'W' votes on a single track.",
                "category": "POLL_WIN_PERCENT",
                "threshold_value": 90,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#E91E63",
                "role_icon": "🔥"
            },
            {
                "slug": "the_comeback",
                "display_name": "The Comeback",
                "description": "Score <4/10, then >8/10 on your very next submission.",
                "category": "SCORE_SWING",
                "threshold_value": 1,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "↩️"
            },
            {
                "slug": "discography",
                "display_name": "Discography",
                "description": "Submit a total of 50 tracks.",
                "category": "SUBMISSION_COUNT",
                "threshold_value": 50,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": "role_veteran_artist", # Placeholder, will need setup
                "role_color": "#9B59B6",
                "role_icon": "📚"
            },
             {
                "slug": "certified_platinum",
                "display_name": "Certified Platinum",
                "description": "Get a 'W' (Win) on 5 consecutive submissions.",
                "category": "WIN_STREAK",
                "threshold_value": 5,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#E5E7EB",
                "role_icon": "💿"
            },
            {
                "slug": "critics_choice",
                "display_name": "Critics Choice",
                "description": "Receive a perfect 10/10 score from the host.",
                "category": "REVIEW_SCORE",
                "threshold_value": 10,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#E74C3C",
                "role_icon": "🏆"
            },
        ])

        # --- CATEGORY B: THE FRONT ROW (TikTok Live API) ---
        definitions.extend([
            {
                "slug": "rainbow",
                "display_name": "Rainbow",
                "description": "Send a Red, Blue, Green, and Purple heart in one stream.",
                "category": "CHAT_RAINBOW",
                "threshold_value": 1,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🌈"
            },
            {
                "slug": "town_crier",
                "display_name": "Town Crier",
                "description": "Send a message fully in ALL CAPS (min 10 chars).",
                "category": "CHAT_ALL_CAPS",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "📢"
            },
            {
                "slug": "emoji_chef",
                "display_name": "Emoji Chef",
                "description": "Send a message containing only emojis (min 5).",
                "category": "CHAT_EMOJI_ONLY",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "👨‍🍳"
            },
            {
                "slug": "the_voter",
                "display_name": "The Voter",
                "description": "Vote in 10 music polls.",
                "category": "POLL_VOTES",
                "threshold_value": 10,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🗳️"
            },
            {
                "slug": "decision_maker",
                "display_name": "Decision Maker",
                "description": "Vote in 100 music polls.",
                "category": "POLL_VOTES",
                "threshold_value": 100,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "⚖️"
            },
             {
                "slug": "hype_man",
                "display_name": "Hype Man",
                "description": "Comment 'W' 10 times in 60 seconds.",
                "category": "CHAT_KEYWORD_SPAM",
                "threshold_value": 10,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "😤"
            },
            {
                "slug": "hype_man",
                "display_name": "Hype Man",
                "description": "Comment 'W' 10 times in 60 seconds.",
                "category": "CHAT_KEYWORD_SPAM",
                "threshold_value": 10,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "😤"
            },
            {
                "slug": "super_fan",
                "display_name": "Super Fan",
                "description": "Send 1,000 Likes to the stream.",
                "category": "LIFETIME_LIKES_SENT",
                "threshold_value": 1000,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "❤️"
            },
            {
                "slug": "big_spender",
                "display_name": "Big Spender",
                "description": "Send 1,000 Diamonds in gifts.",
                "category": "LIFETIME_GIFTS_SENT",
                "threshold_value": 1000,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#9B59B6",
                "role_icon": "💎"
            },
            {
                "slug": "mogul",
                "display_name": "Mogul",
                "description": "Send 10,000 Diamonds in gifts.",
                "category": "LIFETIME_GIFTS_SENT",
                "threshold_value": 10000,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#F1C40F",
                "role_icon": "🕴️"
            },
            {
                "slug": "chatterbox",
                "display_name": "Chatterbox",
                "description": "Send 100 comments in TikTok Live.",
                "category": "LIFETIME_TIKTOK_COMMENTS",
                "threshold_value": 100,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🗣️"
            },
            {
                "slug": "the_sharer",
                "display_name": "The Sharer",
                "description": "Share the stream 10 times.",
                "category": "LIFETIME_TIKTOK_SHARES",
                "threshold_value": 10,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "📲"
            }
        ])

        # --- CATEGORY D: THE COMMUNITY (Discord Socials) ---
        definitions.extend([
            {
                "slug": "welcoming_cmte",
                "display_name": "Welcoming Cmte.",
                "description": "Say 'Welcome' when a new user joins.",
                "category": "DISCORD_WELCOME",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "👋"
            },
            {
                "slug": "sound_check",
                "display_name": "Sound Check",
                "description": "Spend 1 hour in Voice Channels.",
                "category": "DISCORD_VOICE_MINS",
                "threshold_value": 60,
                "tier": 1,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🎤"
            },
            {
                "slug": "the_regular",
                "display_name": "The Regular",
                "description": "Send 1,000 messages in text channels.",
                "category": "DISCORD_MSG_COUNT",
                "threshold_value": 1000,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#2ECC71",
                "role_icon": "💬"
            },
            {
                "slug": "studio_rat",
                "display_name": "Studio Rat",
                "description": "Spend 100 hours in Voice Channels.",
                "category": "DISCORD_VOICE_MINS",
                "threshold_value": 6000,
                "tier": 3,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": "#E67E22",
                "role_icon": "🎙️"
            },
            {
                "slug": "community_legend",
                "display_name": "Community Legend",
                "description": "Send 10,000 messages.",
                "category": "DISCORD_MSG_COUNT",
                "threshold_value": 10000,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🏛️"
            },
            {
                "slug": "screen_time",
                "display_name": "Screen Time",
                "description": "Share your screen in Discord for 1 hour.",
                "category": "DISCORD_SCREEN_SHARE_MINS",
                "threshold_value": 60,
                "tier": 2,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🖥️"
            },
        ])

        # --- CATEGORY E: THE HIDDEN ---
        definitions.extend([
            {
                "slug": "ghosted",
                "display_name": "???", # Hidden
                "description": "???",
                "category": "DISCORD_VC_GHOST",
                "threshold_value": 1,
                "tier": 1,
                "is_hidden": True,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "👻"
            },
            {
                "slug": "broken_record",
                "display_name": "???",
                "description": "???",
                "category": "DISCORD_MSG_REPEAT",
                "threshold_value": 5,
                "tier": 1,
                "is_hidden": True,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🔁"
            }
        ])

        # --- CATEGORY F: BADGES ---
        definitions.extend([

            {
                "slug": "collector",
                "display_name": "Collector",
                "description": "Unlocked 50 total achievements.",
                "category": "TOTAL_ACHIEVEMENTS",
                "threshold_value": 50,
                "tier": 4,
                "is_hidden": False,
                "discord_role_id": None,
                "role_color": None,
                "role_icon": "🎒"
            }
        ])

        try:
            for data in definitions:
                # Check if exists by slug
                result = await db.execute(select(AchievementDefinition).filter_by(slug=data["slug"]))
                exists = result.scalar_one_or_none()

                if not exists:
                    logger.info(f"Creating achievement: {data['display_name']} ({data['slug']})")
                    achievement = AchievementDefinition(
                        id=str(uuid.uuid4()),
                        slug=data["slug"],
                        display_name=data["display_name"],
                        description=data["description"],
                        category=data["category"],
                        threshold_value=data["threshold_value"],
                        tier=data.get("tier", 1),
                        is_hidden=data.get("is_hidden", False),
                        discord_role_id=data["discord_role_id"],
                        role_color=data["role_color"],
                        role_icon=data["role_icon"]
                    )
                    db.add(achievement)
                else:
                    logger.info(f"Updating achievement: {data['slug']}")
                    exists.display_name = data["display_name"]
                    exists.description = data["description"]
                    exists.tier = data.get("tier", 1)
                    exists.is_hidden = data.get("is_hidden", False)
                    exists.role_color = data["role_color"]
                    exists.role_icon = data["role_icon"]
                    # We don't overwrite ID or category typically unless migration needed

            await db.commit()
            logger.info("Seeding complete.")

        except Exception as e:
            logger.error(f"Error seeding achievements: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed_achievements())
