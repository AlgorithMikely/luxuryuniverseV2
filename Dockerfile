# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install PostgreSQL client for pg_isready
RUN apt-get update && apt-get install -y postgresql-client

# Install poetry
RUN pip install poetry

# Copy the dependency files to the container
COPY pyproject.toml poetry.lock ./

# Install project dependencies
RUN poetry install --no-root

# Copy the rest of the application code to the container
COPY . .

COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Expose the port the app runs on
EXPOSE 8000

# Run the application
CMD ["poetry", "run", "python", "main.py"]
