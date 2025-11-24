from sqlalchemy.types import TypeDecorator, TEXT
import json

class JSON(TypeDecorator):
    """
    JSON type that works with SQLite (as TEXT) and PostgreSQL (as JSON).
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return None
