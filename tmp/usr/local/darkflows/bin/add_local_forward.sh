#!/bin/bash
set -e

# Load network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Validate input
if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <external_port> [local_port]"
    echo "Example: $0 5080          # Forward external 5080 to local 5080"
    echo "Example: $0 80 8080       # Forward external 80 to local 8080"
    exit 1
fi

EXT_PORT=$1
LOCAL_PORT=${2:-$EXT_PORT}  # Default to same port if not specified

# Input validation
if ! [[ "$EXT_PORT" =~ ^[0-9]+$ ]] || [ "$EXT_PORT" -lt 1 ] || [ "$EXT_PORT" -gt 65535 ]; then
    echo "Invalid external port number"
    exit 1
fi

if ! [[ "$LOCAL_PORT" =~ ^[0-9]+$ ]] || [ "$LOCAL_PORT" -lt 1 ] || [ "$LOCAL_PORT" -gt 65535 ]; then
    echo "Invalid local port number"
    exit 1
fi

# Check for existing rules
EXISTING=$(nft list ruleset | grep -c "tcp dport $EXT_PORT redirect to :$LOCAL_PORT") || true
if [ "$EXISTING" -ne 0 ]; then
    echo "Port $EXT_PORT is already being forwarded to local port $LOCAL_PORT"
    exit 0
fi

# Add local forwarding rules
echo "Adding local port forwarding $EXT_PORT -> $LOCAL_PORT"

# 1. REDIRECT external traffic to local port
nft add rule ip nat prerouting \
    tcp dport $EXT_PORT \
    redirect to :$LOCAL_PORT

# 2. Allow incoming connections on external port
nft add rule inet filter input \
    tcp dport $EXT_PORT \
    ct state new,established accept

echo "Successfully added local port forward $EXT_PORT -> $LOCAL_PORT"

