from TikTokLive.proto.custom_proto import ExtendedUser
import inspect

print("ExtendedUser fields/properties:")
for name, member in inspect.getmembers(ExtendedUser):
    if not name.startswith('_'):
        print(f"- {name}")
