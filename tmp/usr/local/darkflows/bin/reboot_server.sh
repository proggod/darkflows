#!/bin/bash

# Stop the Next.js application service
systemctl stop nextjs-app

# Check if next-server processes are still running
if pgrep -f "next-server" >/dev/null; then
  echo "Found lingering next-server processes. Force-killing..."
  pkill -9 -f "next-server"
else
  echo "No next-server processes found after service stop."
fi

reboot

