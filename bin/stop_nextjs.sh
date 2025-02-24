#!/bin/bash

echo "Stopping Next.js application..."

# Find and gracefully stop Next.js processes
pkill -f "next-server"

# Wait a moment to let it exit
sleep 3

# Force kill if any remain
if pgrep -f "next-server" >/dev/null; then
  echo "Force killing remaining Next.js processes..."
  pkill -9 -f "next-server"
else
  echo "Next.js stopped successfully."
fi

