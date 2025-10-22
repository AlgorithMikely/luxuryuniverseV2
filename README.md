# Universe Bot

Universe Bot is a full-stack music review and community platform for streamers. It allows them to manage track submissions from their community via a Discord bot and a real-time web dashboard.

## Features

- **Discord Bot**: Passively monitors channels for song submissions and provides slash commands for queue management.
- **Real-time Web Dashboard**: A React-based frontend for reviewers to manage their queue in real-time.
- **Economy System**: A "Luxury Coins" system to reward users for engagement on Discord and TikTok.
- **TikTok Integration**: A listener that connects to TikTok Live events to award coins for likes and gifts.

## Technology Stack

- **Backend**: Python, FastAPI, SQLAlchemy, Alembic, `discord.py`, `python-socketio`, `TikTokLive`
- **Frontend**: React, TypeScript, Vite, Zustand, Tailwind CSS, `socket.io-client`
- **Database**: SQLite (development), PostgreSQL (production)

## Deployment with Docker (Recommended)

1.  **Clone the repository.**
2.  **Create a `.env` file** in the project root with the following variables. These will be used by Docker Compose to configure the services.
    ```env
    # PostgreSQL Settings
    POSTGRES_USER=user
    POSTGRES_PASSWORD=password
    POSTGRES_DB=universe_bot

    # Discord Settings
    DISCORD_TOKEN=your_discord_bot_token
    DISCORD_CLIENT_ID=your_discord_client_id
    DISCORD_CLIENT_SECRET=your_discord_client_secret
    ```
3.  **Run the application:**
    ```bash
    docker-compose up --build
    ```
    This command will build the Docker images and start all the services. The frontend will be available at `http://localhost:5173`.

## Manual Setup (for Development)

### Prerequisites

- Python 3.12+
- Node.js 16+
- A Discord Bot Token
- A Discord Client ID and Secret

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Create a virtual environment and install dependencies:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    poetry install
    ```

3.  **Create a `.env` file** in the root of the project and add the following environment variables:
    ```
    DATABASE_URL=sqlite:///./dev.db
    DISCORD_TOKEN=your_discord_bot_token
    DISCORD_CLIENT_ID=your_discord_client_id
    DISCORD_CLIENT_SECRET=your_discord_client_secret
    ```

4.  **Run database migrations:**
    ```bash
    poetry run alembic upgrade head
    ```

5.  **Run the backend server:**
    ```bash
    poetry run python main.py
    ```

### Frontend Setup

1.  **Navigate to the `frontend` directory:**
    ```bash
    cd frontend
    ```

2.  **Install npm dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```

The frontend will be available at `http://localhost:5173`.

## Usage

1.  **Invite the Discord bot** to your server.
2.  **Manually add a `Reviewer` entry** to your database, linking your Discord user ID to a specific channel ID.
3.  **Open the web dashboard** at `http://localhost:5173` and log in with Discord.
4.  **Start submitting songs** in the monitored Discord channel.
