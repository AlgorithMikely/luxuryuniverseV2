from TikTokLive.events import CommentEvent
import inspect
import typing

print("CommentEvent annotations:")
for name, type_hint in typing.get_type_hints(CommentEvent).items():
    print(f"- {name}: {type_hint}")
