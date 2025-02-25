#!/bin/bash

# Generate a secure random string for SESSION_SECRET if not exists
if [ ! -f .session-secret ]; then
    openssl rand -base64 32 > .session-secret
fi

# Load session secret
export SESSION_SECRET=$(cat .session-secret)
echo "Using SESSION_SECRET from .session-secret file"

# Set production environment
export NODE_ENV=production
export PORT=4080
export NEXT_TELEMETRY_DISABLED=1

# Start the server
echo "Starting server in production mode on port 4080..."
npm run start 