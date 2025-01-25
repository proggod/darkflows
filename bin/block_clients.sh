#!/bin/bash
# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

BLOCKED_FILE="/etc/darkflows/blocked_clients.txt"

# First, clear any existing blocks
echo "Clearing existing blocks..."
HANDLES=$(nft -a list chain inet filter forward | grep -E "ether saddr|ip saddr.*drop" | awk '{print $NF}')
if [ -n "$HANDLES" ]; then
    for handle in $HANDLES; do
        nft delete rule inet filter forward handle $handle
    done
fi

# Function to validate IP address
validate_ip() {
    if [[ $1 =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to validate MAC address
validate_mac() {
    if [[ $1 =~ ^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$ ]]; then
        return 0
    else
        return 1
    fi
}

# Read and process the blocked_clients.txt file
echo "Processing blocked clients file..."
if [ -f "$BLOCKED_FILE" ]; then
    # Read file content and ensure it ends with a newline
    content=$(cat "$BLOCKED_FILE"; echo x)
    content=${content%x}
    
    while IFS= read -r address || [ -n "$address" ]; do
        if [ -n "$address" ]; then  # Skip empty lines
            if validate_ip "$address"; then
                echo "Adding IP $address to blocked list..."
                nft "insert rule inet filter forward iif $INTERNAL_INTERFACE ip saddr $address drop"
            elif validate_mac "$address"; then
                echo "Adding MAC $address to blocked list..."
                nft "insert rule inet filter forward iif $INTERNAL_INTERFACE ether saddr $address drop"
            else
                echo "Warning: Invalid address format found: $address"
            fi
        fi
    done <<< "$content"
else
    echo "Warning: Blocked clients file not found at $BLOCKED_FILE"
    exit 1
fi

echo "Blocking complete."

