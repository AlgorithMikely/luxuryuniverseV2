import asyncio
import uvicorn
from bot_main import main as bot_main
from api_main import app

async def main():
    """Runs the bot and the API concurrently."""
    bot_task = asyncio.create_task(bot_main())

    # Uvicorn configuration
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
    server = uvicorn.Server(config)

    await asyncio.gather(bot_task, server.serve())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Application shut down.")
