#!/bin/bash

# Check if service name is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <service-name>"
    exit 1
fi

# Get journal entries for the service from last 10 minutes, show errors
journalctl -u "$1" --since "10 minutes ago" -p 3

