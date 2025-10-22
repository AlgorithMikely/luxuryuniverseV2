# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install poetry
RUN pip install poetry

# Copy the dependency files to the container
COPY pyproject.toml poetry.lock ./

# Install project dependencies
RUN poetry install --no-root

# Copy the rest of the application code to the container
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Run the application
CMD ["poetry", "run", "python", "main.py"]
