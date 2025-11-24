# Universe Bot

Universe Bot is a comprehensive, full-stack platform designed for music reviewers and streamers. It streamlines the process of accepting, managing, and reviewing track submissions from a community, featuring a robust economy system and real-time interactivity.

## ✨ Features

### 🎵 Core Functionality
*   **Discord Integration:** Passively monitors dedicated Discord channels for music links (Spotify, YouTube, SoundCloud) and file attachments.
*   **Real-Time Dashboard:** A React-based web interface that updates instantly when new tracks are submitted or the queue advances.
*   **Smart-Zone Queue:** Advanced queue management that supports priority tiers ("Skip the Line"), batch processing, and "Double Features" (two tracks back-to-back).
*   **Reviewer Isolation:** Fully supports multiple reviewers on a single instance. Each reviewer has their own isolated queue, settings, and community data.

### 💰 Economy & Gamification
*   **Luxury Coins:** A built-in currency system. Users earn coins by engaging in chat (text/voice) or interacting on TikTok Live.
*   **Custom Rewards:** Reviewers can set coin costs for actions like "Skip the Line" or "Spotlight Submission".
*   **Achievements:** Users unlock badges and Discord roles for milestones (e.g., "100 Submissions", "Top Chatter").
*   **TikTok Live Listener:** Automatically rewards users for sending Likes, Gifts, or following the host during a TikTok Live stream.

### 🛠️ Tools for Reviewers
*   **Multi-Source Player:** Integrated web player supporting YouTube, Spotify, and direct audio files (with WaveSurfer visualization).
*   **OBS Overlay:** A customizable browser source for OBS that displays the "Now Playing" track and queue stats to your stream.
*   **History & Stats:** detailed logs of every reviewed track, including scores and notes.

---

## 🚀 Quick Start (Production)

The recommended way to run Universe Bot is using Docker Compose. This ensures all dependencies (Database, Backend, Frontend) are configured correctly.

### Prerequisites
1.  **Docker & Docker Compose** installed on your server.
2.  **Discord Bot Token:** Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications).
3.  **Spotify API Credentials:** (Optional) For better Spotify link parsing. Get them at the [Spotify Dashboard](https://developer.spotify.com/dashboard/).

### Setup Steps

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/yourusername/universe-bot.git
    cd universe-bot
    ```

2.  **Configure Environment:**
    Create a `.env` file in the project root. Copy the content below and fill in your secrets:

    ```env
    # --- Database (PostgreSQL) ---
    POSTGRES_USER=universe_user
    POSTGRES_PASSWORD=secure_password_here
    POSTGRES_DB=universe_bot

    # --- Discord ---
    DISCORD_TOKEN=your_bot_token_here
    DISCORD_CLIENT_ID=your_client_id
    DISCORD_CLIENT_SECRET=your_client_secret
    DISCORD_REDIRECT_URI=https://yourdomain.com/api/auth/callback

    # --- Admin Access ---
    # Comma-separated list of Discord User IDs who can manage reviewers
    ADMIN_DISCORD_IDS=123456789012345678,987654321098765432

    # --- Optional Integrations ---
    SPOTIFY_CLIENT_ID=your_spotify_id
    SPOTIFY_CLIENT_SECRET=your_spotify_secret

    # Stripe (for payments)
    STRIPE_SECRET_KEY=sk_test_...
    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

    # Cloudflare R2 (for file storage)
    R2_ACCOUNT_ID=...
    R2_ACCESS_KEY_ID=...
    R2_SECRET_ACCESS_KEY=...
    R2_BUCKET_NAME=...
    R2_PUBLIC_URL=...
    ```

3.  **Launch:**
    ```bash
    docker compose up -d --build
    ```

4.  **Access:**
    *   **Dashboard:** `http://localhost:5173` (or your domain).
    *   **API Docs:** `http://localhost:8000/docs`.

---

## 📖 User Guide

### 1. Setting Up a Reviewer
Once the bot is running and invited to your server:
1.  Log in to the web dashboard using your Admin Discord account.
2.  Navigate to the **Admin Panel**.
3.  Create a new Reviewer profile:
    *   Link a Discord User.
    *   **Important:** The bot will automatically create a category (e.g., `username-reviews`) and channels (`#submit-music-here`, `#view-the-line`) in your Discord server for that reviewer.

### 2. Managing the Queue
*   **Opening the Queue:** In the Dashboard sidebar, toggle the "Queue Status" to **Open**.
*   **Submitting Tracks:** Users simply paste a link (YouTube/Spotify) or upload a file in the `#submit-music-here` channel.
*   **Reviewing:**
    *   Drag and drop tracks to reorder them.
    *   Click **"Play"** to load the media.
    *   Rate the track (1-10) and add notes.
    *   Click **"Complete Review"** to save to history and move to the next track.

### 3. Discord Commands
The bot supports several slash commands.

| Command | Description |
| :--- | :--- |
| `/queue` | Shows the current list of pending tracks. |
| `/next` | (Reviewer Only) Advances the queue and shows the next track. |
| `/balance` | Check your current Luxury Coin balance. |
| `/gamification setup_roles` | (Admin) Creates Discord roles for achievements. |

---

## 🔧 Configuration Reference

A full list of supported environment variables for `config.py`:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DISCORD_TOKEN` | ✅ | The authentication token for your Discord bot. |
| `DISCORD_CLIENT_ID` | ✅ | OAuth2 Client ID. |
| `DISCORD_CLIENT_SECRET` | ✅ | OAuth2 Client Secret. |
| `DISCORD_REDIRECT_URI` | ✅ | URL where Discord redirects after login (e.g., `https://site.com/api/auth/callback`). |
| `ADMIN_DISCORD_IDS` | ❌ | List of User IDs with super-admin privileges. |
| `POSTGRES_...` | ✅ | Database credentials (User, Password, DB Name). |
| `SPOTIFY_CLIENT_ID` | ❌ | Enables Spotify link metadata fetching. |
| `STRIPE_SECRET_KEY` | ❌ | Enables Stripe payment processing. |
| `R2_...` | ❌ | Cloudflare R2 credentials for storing file uploads. |

---

## 🧑‍💻 For Developers

Interested in contributing or modifying the code? Please read our [Developer Guide](DEVELOPERS.md) for detailed instructions on architecture, local setup, and testing.

## 📄 License

[MIT License](LICENSE)
