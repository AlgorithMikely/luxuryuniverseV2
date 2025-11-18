import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from api_main import app
import bot_instance
import asyncio

client = TestClient(app)

@pytest.mark.anyio
async def test_proxy_audio_bot_not_ready():
    # Ensure bot is not ready
    bot_instance.bot_ready = asyncio.Event()
    bot_instance.bot = None
    
    # Mock wait_for to timeout
    with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
        response = client.get("/api/proxy/audio?url=https://discord.com/channels/1/2/3")
        assert response.status_code == 503
        assert "Bot is not ready" in response.json()["detail"]

@pytest.mark.anyio
async def test_proxy_audio_bot_not_initialized():
    # Ensure bot is ready event is set, but bot is None
    bot_instance.bot_ready = asyncio.Event()
    bot_instance.bot_ready.set()
    bot_instance.bot = None
    
    # We need to patch wait_for to just return (since event is set)
    # But wait_for is an async function.
    # Actually, if event is set, wait_for(event.wait(), timeout) returns immediately.
    
    response = client.get("/api/proxy/audio?url=https://discord.com/channels/1/2/3")
    assert response.status_code == 503
    assert "Bot is not initialized" in response.json()["detail"]

@pytest.mark.anyio
async def test_proxy_audio_success():
    # Mock bot and channel
    mock_bot = MagicMock()
    mock_channel = AsyncMock()
    mock_message = AsyncMock()
    mock_attachment = MagicMock()
    mock_attachment.url = "http://example.com/audio.mp3"
    mock_message.attachments = [mock_attachment]
    mock_channel.fetch_message.return_value = mock_message
    mock_bot.get_channel.return_value = mock_channel
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from api_main import app
import bot_instance
import asyncio

client = TestClient(app)

@pytest.mark.anyio
async def test_proxy_audio_bot_not_ready():
    # Ensure bot is not ready
    bot_instance.bot_ready = asyncio.Event()
    bot_instance.bot = None
    
    # Mock wait_for to timeout
    with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
        response = client.get("/api/proxy/audio?url=https://discord.com/channels/1/2/3")
        assert response.status_code == 503
        assert "Bot is not ready" in response.json()["detail"]

@pytest.mark.anyio
async def test_proxy_audio_bot_not_initialized():
    # Ensure bot is ready event is set, but bot is None
    bot_instance.bot_ready = asyncio.Event()
    bot_instance.bot_ready.set()
    bot_instance.bot = None
    
    # We need to patch wait_for to just return (since event is set)
    # But wait_for is an async function.
    # Actually, if event is set, wait_for(event.wait(), timeout) returns immediately.
    
    response = client.get("/api/proxy/audio?url=https://discord.com/channels/1/2/3")
    assert response.status_code == 503
    assert "Bot is not initialized" in response.json()["detail"]

@pytest.mark.anyio
async def test_proxy_audio_success():
    # Mock bot and channel
    mock_bot = MagicMock()
    mock_channel = AsyncMock()
    mock_message = AsyncMock()
    mock_attachment = MagicMock()
    mock_attachment.url = "http://example.com/audio.mp3"
    mock_message.attachments = [mock_attachment]
    mock_channel.fetch_message.return_value = mock_message
    mock_bot.get_channel.return_value = mock_channel
    
    bot_instance.bot = mock_bot
    bot_instance.bot_ready = asyncio.Event()
    bot_instance.bot_ready.set()
    
    # Mock httpx to return audio data
    with patch("httpx.AsyncClient.get") as mock_get, \
         patch("yt_dlp.YoutubeDL") as mock_ytdl:
        
        # Mock yt_dlp context manager
        mock_ydl_instance = MagicMock()
        mock_ytdl.return_value.__enter__.return_value = mock_ydl_instance
        mock_ydl_instance.extract_info.return_value = {"url": "http://example.com/audio.mp3"}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = b"audio data"
        mock_response.headers = {"Content-Type": "audio/mpeg"}
        mock_get.return_value = mock_response
        
        response = client.get("/api/proxy/audio?url=https://discord.com/channels/123/456/789")
        assert response.status_code == 200
        assert response.content == b"audio data"
