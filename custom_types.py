import json
from sqlalchemy.types import TypeDecorator, TEXT
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects import postgresql

class JsonEncodedList(TypeDecorator):
    """
    This custom type stores a Python list in a TEXT column for SQLite
    and in a native ARRAY column for PostgreSQL.
    """
    impl = TEXT

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            # For PostgreSQL, use the native ARRAY type.
            # We assume the array elements are integers.
            return dialect.type_descriptor(ARRAY(postgresql.INTEGER))
        else:
            # For other dialects (like SQLite), use a TEXT column.
            return dialect.type_descriptor(TEXT())

    def process_bind_param(self, value, dialect):
        if value is None:
            return value

        if dialect.name == 'postgresql':
            # For PostgreSQL, the value is passed as a list directly.
            return value
        else:
            # For SQLite, serialize the list to a JSON string.
            return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value

        if dialect.name == 'postgresql':
            # For PostgreSQL, the value is returned as a list directly.
            return value
        else:
            # For SQLite, deserialize the JSON string back to a list.
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return []
