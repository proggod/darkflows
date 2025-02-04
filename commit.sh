#!/bin/bash

# Check if a commit message is provided
if [ -z "$1" ]; then
    echo "Usage: $0 \"commit message\""
    exit 1
fi

# Copy files
cp src/live-ifstat/README.md .
cp src/live-ifstat/LICENSE .

# Add all changes
git add *

# Commit with the provided message
git commit -am "$1"

# Push changes
git push

