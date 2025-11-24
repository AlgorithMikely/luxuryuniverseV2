import httpx
import re
import logging
from typing import Optional, Dict, Any

async def get_track_metadata(url: str) -> Dict[str, Any]:
    """
    Fetches metadata for a SoundCloud track using OEmbed and page scraping.
    """
    metadata = {
        "title": "Unknown Title",
        "artist": "Unknown Artist",
        "thumbnail_url": None,
        "waveform_url": None,
        "genre": None
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # 1. OEmbed for basic info
        try:
            oembed_url = f"https://soundcloud.com/oembed?format=json&url={url}"
            response = await client.get(oembed_url)
            if response.status_code == 200:
                data = response.json()
                metadata["title"] = data.get("title", "")
                metadata["artist"] = data.get("author_name", "")
                metadata["thumbnail_url"] = data.get("thumbnail_url", "")
                
                # SoundCloud titles often are "Artist - Title"
                # If author_name is present, try to clean title
                if metadata["artist"] and metadata["title"].startswith(metadata["artist"] + " - "):
                    metadata["title"] = metadata["title"][len(metadata["artist"]) + 3:]
                elif metadata["artist"] and metadata["title"].startswith(metadata["artist"] + "-"):
                     metadata["title"] = metadata["title"][len(metadata["artist"]) + 1:]

        except Exception as e:
            logging.error(f"SoundCloud OEmbed failed: {e}")

        # 2. Page Scraping for Waveform and Genre
        try:
            page_response = await client.get(url)
            if page_response.status_code == 200:
                html = page_response.text
                
                # Regex for waveform_url
                # Look for "waveform_url":"..."
                waveform_match = re.search(r'"waveform_url":"(https://[^"]+)"', html)
                if waveform_match:
                    metadata["waveform_url"] = waveform_match.group(1)
                
                # Regex for genre
                # Look for "genre":"..."
                genre_match = re.search(r'"genre":"([^"]+)"', html)
                if genre_match:
                    metadata["genre"] = genre_match.group(1)
                    
                # Fallback for artwork if OEmbed failed or gave low res
                if not metadata["thumbnail_url"]:
                     artwork_match = re.search(r'"artwork_url":"(https://[^"]+)"', html)
                     if artwork_match:
                         metadata["thumbnail_url"] = artwork_match.group(1)

        except Exception as e:
            logging.error(f"SoundCloud Page Scraping failed: {e}")

    return metadata
