import TikTokLive
import inspect

print("TikTokLive version:", getattr(TikTokLive, "__version__", "Unknown"))
print("Dir TikTokLive:", dir(TikTokLive))

try:
    from TikTokLive.client.web.web_settings import WebDefaults
    print("WebDefaults found in TikTokLive.client.web.web_settings")
    print("WebDefaults attributes:", dir(WebDefaults))
except ImportError:
    print("WebDefaults not found in TikTokLive.client.web.web_settings")

try:
    from TikTokLive.client.web.web_client import TikTokWebClient
    print("TikTokWebClient found")
except ImportError:
    print("TikTokWebClient not found")
