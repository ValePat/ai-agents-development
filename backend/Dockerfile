# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create a non-root user and group with a home directory
RUN groupadd -r appgroup && useradd -r -g appgroup -m -d /home/appuser appuser

# Set work directory
WORKDIR /app

# Install system dependencies (e.g., for node/npx as mentioned in README)
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package.json .
RUN npm install

# Copy project files
COPY . .

# Ensure the sandbox directory exists and set permissions for app and home
RUN mkdir -p sandbox && \
    chown -R appuser:appgroup /app && \
    chown -R appuser:appgroup /home/appuser

# Switch to non-root user
USER appuser
ENV HOME=/home/appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
