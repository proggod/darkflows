#!/bin/bash
# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

echo "Clearing all blocking rules..."

# Get all rule handles that contain 'drop' and are for blocked IPs or MACs
HANDLES=$(nft -a list chain inet filter forward | grep -E "ether saddr|ip saddr.*drop" | awk '{print $NF}')

if [ -n "$HANDLES" ]; then
    for handle in $HANDLES; do
        nft delete rule inet filter forward handle $handle
    done
    echo "All blocking rules have been removed."
else
    echo "No blocking rules found."
fi

echo "Current ruleset:"
#nft list chain inet filter forward

