from TikTokLive.proto.tiktok_proto import User
import inspect

print("User fields:")
for field in User.__dataclass_fields__:
    print(f"- {field}")

print("\nUser methods/properties:")
for name, member in inspect.getmembers(User):
    if not name.startswith('_'):
        print(f"- {name}")
