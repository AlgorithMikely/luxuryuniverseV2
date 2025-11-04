#!/bin/sh
set -e

# Wait for the database to be fully ready
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-user}"; do
  echo "Waiting for database to be ready..."
  sleep 2
done

echo "Database is up - running migrations"
poetry run alembic upgrade head

echo "Migrations complete - starting server"
exec poetry run "$@"
