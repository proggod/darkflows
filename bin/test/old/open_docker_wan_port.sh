#!/bin/bash

# Load network config
source /etc/darkflows/d_network.cfg || { echo "Failed to source network config"; exit 1; }

# Docker bridge (matches nftables.sh)
DOCKER_BRIDGE="${DOCKER_BRIDGE:-$(docker network inspect bridge -f '{{.Id}}' | cut -c1-12)}" || DOCKER_BRIDGE="docker0"

# Validate input
if [ $# -ne 1 ]; then
    echo "Usage: $0 <port>"
    exit 1
fi
PORT=$1

# Check existing rules
EXISTING=$(nft list ruleset | grep -c "tcp dport $PORT")
if [ "$EXISTING" -gt 0 ]; then
    echo "Port $PORT is already open"
    exit 0
fi

# Allow on both WAN interfaces
nft add rule inet filter input \
    iif {$PRIMARY_INTERFACE,$SECONDARY_INTERFACE} \
    tcp dport $PORT \
    ct state new,established accept

nft add rule inet filter forward \
    iif {$PRIMARY_INTERFACE,$SECONDARY_INTERFACE} \
    tcp dport $PORT \
    oifname $DOCKER_BRIDGE \
    accept

echo "Opened port $PORT on WAN interfaces: $PRIMARY_INTERFACE $SECONDARY_INTERFACE"

