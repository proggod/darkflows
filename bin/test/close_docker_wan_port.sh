#!/bin/bash

# Load network config
source /etc/darkflows/d_network.cfg || { echo "Failed to source network config"; exit 1; }

# Validate input
if [ $# -ne 1 ]; then
    echo "Usage: $0 <port>"
    exit 1
fi
PORT=$1

# Delete rules by handle
nft list ruleset -a | grep "tcp dport $PORT" | awk '{print $NF}' | while read handle; do
    nft delete rule inet filter input handle $handle
done

nft list ruleset -a | grep "tcp dport $PORT" | awk '{print $NF}' | while read handle; do
    nft delete rule inet filter forward handle $handle
done

echo "Closed port $PORT on WAN interfaces"


