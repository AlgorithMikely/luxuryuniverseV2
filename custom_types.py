from sqlalchemy.types import JSON as SA_JSON

# Alias to SQLAlchemy's JSON type which handles dialect differences (JSON for Postgres, TEXT/JSON for SQLite)
JSON = SA_JSON
