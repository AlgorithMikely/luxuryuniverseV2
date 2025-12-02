import asyncio
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, CommentEvent

async def test_connection(unique_id):
    print(f"Attempting to connect to @{unique_id}...")
    client = TikTokLiveClient(unique_id=f"@{unique_id}")

    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        print(f"Connected to Room ID: {event.room_id}")

    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        print(f"{event.user.nickname}: {event.comment}")

    try:
        await client.start()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test with the problematic handle
    asyncio.run(test_connection("luxuryforbes"))
