#!/bin/sh
set -e

# Wait for the database to be ready
# This is a simple loop, a more robust solution might use pg_isready
until poetry run python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('db', 5432))" 2>/dev/null; do
  echo "Waiting for database..."
  sleep 1
done

echo "Database is up - running migrations"
poetry run alembic upgrade head

echo "Migrations complete - starting server"
exec poetry run python main.py
