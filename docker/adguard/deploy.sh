#!/bin/bash

# Set deployment directory
DEPLOY_DIR="/usr/local/darkflows/docker/adguard/"

# Ensure the directory exists
mkdir -p "$DEPLOY_DIR"
mkdir -p /usr/local/darkflows/docker/adguard/data/work
mkdir -p /usr/local/darkflows/docker/adguard/data/conf


# Move to deployment directory
cd "$DEPLOY_DIR" || exit

# Check if docker compose.yml exists; if not, create it
if [ ! -f docker-compose.yml ]; then
    echo "Missing compose file"
    exit
fi

# Pull the latest AdGuard Home image
echo "Pulling latest AdGuard Home image..."
docker pull adguard/adguardhome

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "adguardhome"; then
    echo "Stopping and removing the existing AdGuard Home container..."
    docker compose down
fi

# Start the container
echo "Starting AdGuard Home..."
docker compose up -d

# Enable auto-start on boot
echo "Ensuring AdGuard Home starts on boot..."
systemctl enable docker

echo "Deployment complete!"

