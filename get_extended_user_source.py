import inspect
from TikTokLive.proto.custom_proto import ExtendedUser
from TikTokLive.proto.tiktok_proto import User

with open("extended_user_source.txt", "w", encoding="utf-8") as f:
    f.write("=== ExtendedUser Source ===\n")
    try:
        f.write(inspect.getsource(ExtendedUser))
    except Exception as e:
        f.write(f"Could not get source for ExtendedUser: {e}\n")
    
    f.write("\n\n=== User Source ===\n")
    try:
        f.write(inspect.getsource(User))
    except Exception as e:
        f.write(f"Could not get source for User: {e}\n")

    f.write("\n\n=== ExtendedUser MRO ===\n")
    f.write(str(ExtendedUser.mro()))
