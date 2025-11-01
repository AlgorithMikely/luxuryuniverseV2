#!/bin/sh
set -e

# Wait for the database to be fully ready
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-user}"; do
  echo "Waiting for database to be ready..."
  sleep 2
done

# Ensure DATABASE_URL is set for Alembic
export DATABASE_URL="postgresql://${POSTGRES_USER:-user}:${POSTGRES_PASSWORD:-password}@db:5432/${POSTGRES_DB:-app}"

echo "Database is up - running migrations"
poetry run alembic upgrade head

echo "Migrations complete - starting server"
exec poetry run python main.py
