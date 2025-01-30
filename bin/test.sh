#!/bin/bash

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Wait for Docker to be fully ready (max 5 minutes)
echo "Waiting for Docker service..."
max_wait=300
wait_time=0
while ! docker info >/dev/null 2>&1; do
    if [ $wait_time -ge $max_wait ]; then
        echo "Timeout waiting for Docker service."
        exit 1
    fi
    sleep 5
    wait_time=$((wait_time + 5))
done

# Additional check for docker commands
while ! docker ps >/dev/null 2>&1; do
    if [ $wait_time -ge $max_wait ]; then
        echo "Timeout waiting for Docker to respond to commands."
        exit 1
    fi
    sleep 5
    wait_time=$((wait_time + 5))
done

echo "Docker is ready"

# Now you can run your route_docker.sh script


