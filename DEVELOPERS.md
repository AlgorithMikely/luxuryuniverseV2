# Developer Guide

Welcome to the Universe Bot developer documentation. This guide provides a deep dive into the project's architecture, codebase structure, and local development workflow.

## 1. Architecture Overview

Universe Bot is a distributed system composed of three main services, orchestrated via Docker Compose.

### High-Level Diagram

```mermaid
graph TD
    User[User] -->|HTTPS| Frontend[React Frontend (Nginx/Vite)]
    Reviewer[Reviewer] -->|HTTPS| Frontend

    Frontend -->|REST API /api| Backend[FastAPI Backend]
    Frontend -->|Socket.IO| Backend

    Discord[Discord API] <-->|WebSocket| Bot[Discord Bot (discord.py)]

    Backend <-->|SQLAlchemy| DB[(PostgreSQL)]
    Bot <-->|SQLAlchemy| DB

    Backend -->|Direct Access| BotInstance[Shared Bot Instance]
```

### Core Components

1.  **Backend (FastAPI):**
    *   **Role:** The central brain of the application. Handles HTTP requests, authentication, business logic, and real-time WebSocket events.
    *   **Key Features:**
        *   RESTful API for the frontend.
        *   Socket.IO server for real-time queue updates.
        *   OAuth2 (Discord & Spotify) integration.

2.  **Discord Bot (`discord.py`):**
    *   **Role:** Handles all interactions within Discord.
    *   **Key Features:**
        *   Passively monitors channels for track submissions.
        *   Executes slash commands (e.g., `/queue`, `/next`).
        *   Manages gamification events (voice time, message counts).
    *   **Integration:** Runs in a separate thread alongside the FastAPI app (`api_main.py`) but shares the same database connection pool.

3.  **Frontend (React + Vite):**
    *   **Role:** The user interface for reviewers and admins.
    *   **Key Features:**
        *   **Reviewer Dashboard:** Real-time drag-and-drop queue, media player (YouTube/Spotify/WaveSurfer).
        *   **User Hub:** Stats, submission history, and profile management.
        *   **State Management:** `Zustand` for global state (Auth, Queue).

4.  **Database (PostgreSQL):**
    *   **Role:** Persistent storage for all services.
    *   **Schema:** Managed via SQLAlchemy models and Alembic migrations.

---

## 2. Tech Stack & Libraries

### Backend
*   **Framework:** `FastAPI` (High-performance async web framework)
*   **Language:** Python 3.12+
*   **ORM:** `SQLAlchemy` (Async interaction with PostgreSQL/SQLite)
*   **Migrations:** `Alembic`
*   **Discord:** `discord.py`
*   **WebSockets:** `python-socketio`
*   **Validation:** `Pydantic` (Data validation and settings management)
*   **Media Processing:** `yt-dlp` (URL metadata extraction), `spotipy` (Spotify API)
*   **Storage:** `boto3` (Cloudflare R2 / S3 compatible storage)

### Frontend
*   **Framework:** `React` (v18+)
*   **Build Tool:** `Vite`
*   **Language:** `TypeScript`
*   **Styling:** `Tailwind CSS`
*   **State Management:** `Zustand`
*   **Icons:** `lucide-react`
*   **Audio:** `wavesurfer.js` (Visualizations), `Spotify Web Playback SDK`

### Infrastructure
*   **Containerization:** Docker & Docker Compose
*   **Reverse Proxy:** Nginx (in Production)
*   **Database:** PostgreSQL 14

---

## 3. Project Structure

A guided tour of the repository:

```
universe-bot/
├── alembic/              # Database migration scripts
├── api/                  # FastAPI Routers (endpoints)
│   ├── auth.py           # Authentication logic
│   ├── reviewer_api.py   # Queue management endpoints
│   └── ...
├── cogs/                 # Discord Bot Modules (Cogs)
│   ├── submission_cog.py # Logic for receiving tracks
│   ├── queue_cog.py      # /next and /queue commands
│   └── ...
├── frontend/             # React Application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level pages (Dashboard, Login)
│   │   ├── stores/       # Zustand state stores
│   │   └── ...
│   └── Dockerfile
├── services/             # Business Logic Layer
│   ├── queue_service.py  # Core queue manipulation logic
│   ├── economy_service.py# Coin & transaction logic
│   └── ...
├── tests/                # Pytest suite
├── api_main.py           # FastAPI entry point
├── bot_main.py           # Standalone bot entry point (legacy/dev)
├── config.py             # Configuration & Env Vars
├── models.py             # SQLAlchemy Database Models
├── schemas.py            # Pydantic Data Schemas
└── docker-compose.yml    # Service orchestration
```

---

## 4. Local Development Setup

### Prerequisites
*   **Docker Desktop** (Recommended for database)
*   **Python 3.12+**
*   **Node.js 18+**
*   **Poetry** (Python dependency manager)

### Option A: Hybrid (Recommended)
Run the database in Docker, but run the Backend and Frontend locally for fast reload/debugging.

1.  **Start the Database:**
    ```bash
    docker compose up -d db
    ```

2.  **Backend Setup:**
    *   Create a `.env` file in the root (see `README.md` for variables).
    *   Install dependencies:
        ```bash
        poetry install
        ```
    *   Run Migrations:
        ```bash
        poetry run alembic upgrade head
        ```
    *   Start the Server (Hot Reload):
        ```bash
        poetry run uvicorn api_main:app --reload --port 8000
        ```
        *Note: This also starts the Discord bot thread.*

3.  **Frontend Setup:**
    *   Navigate to `frontend/`:
        ```bash
        cd frontend
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   Start Dev Server:
        ```bash
        npm run dev
        ```
    *   Access at `http://localhost:5173`.

### Option B: Full Docker
Run everything in containers. Good for verifying production builds.

```bash
docker compose up --build
```

---

## 5. Database Migrations

When modifying `models.py`, you must create a migration script to update the database schema.

1.  **Make changes** to `models.py`.
2.  **Generate Migration:**
    ```bash
    poetry run alembic revision --autogenerate -m "description_of_change"
    ```
3.  **Review the Script:** Check `alembic/versions/` to ensure the generated script is correct.
4.  **Apply Migration:**
    ```bash
    poetry run alembic upgrade head
    ```

---

## 6. Testing

### Backend Tests
We use `pytest` for backend testing.

```bash
# Run all tests
poetry run pytest

# Run specific test file
poetry run pytest tests/test_api.py
```

**Note:** Tests often use a temporary SQLite database in memory. Ensure your models work with SQLite types (e.g., using the custom `JSON` types in `models.py`).

### Frontend Verification
Frontend tests are primarily manual or end-to-end using Playwright (if configured).
*   **Linting:** `npm run lint`
*   **Type Check:** `npm run tsc`

---

## 7. Contribution Guidelines

1.  **Feature Branches:** Create a new branch for every feature or bugfix (`feature/new-queue-logic`).
2.  **Reviewer Isolation:** Always respect the `reviewer_id` foreign key. Never expose one reviewer's data to another.
3.  **Environment Variables:** Never hardcode secrets. Use `config.py`.
4.  **Clean Code:**
    *   Python: Follow PEP 8.
    *   TypeScript: Strict typing is enforced.
5.  **Commit Messages:** Be descriptive.
