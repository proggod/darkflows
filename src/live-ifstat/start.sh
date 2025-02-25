#!/bin/bash

# Generate a secure random string for SESSION_SECRET if not exists
if [ ! -f .session-secret ]; then
    openssl rand -base64 32 > .session-secret
fi

# Load session secret
export SESSION_SECRET=$(cat .session-secret)
echo "Using SESSION_SECRET from .session-secret file"

# Set environment based on flag
if [[ "$*" == *"--dev"* ]]; then
  export NODE_ENV=development
  export NEXT_TELEMETRY_DISABLED=1
  echo "Starting in development mode..."
  npm run dev
else
  export NODE_ENV=production
  export PORT=4080
  export NEXT_TELEMETRY_DISABLED=1
  echo "Starting server in production mode on port 4080..."
  npm run start
fi 
