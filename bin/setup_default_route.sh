#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg

# Define the lease file paths for primary and secondary interfaces
LEASE_FILE_PRIMARY="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
LEASE_FILE_SECONDARY="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"

# Function to extract the gateway from a lease file
get_gateway() {
    local lease_file="$1"
    if [[ -f "$lease_file" ]]; then
        grep 'option routers' "$lease_file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

# Get gateways for both interfaces
GATEWAY_PRIMARY=$(get_gateway "$LEASE_FILE_PRIMARY")
GATEWAY_SECONDARY=$(get_gateway "$LEASE_FILE_SECONDARY")

# Check if gateways were found
if [[ -z "$GATEWAY_PRIMARY" ]]; then
    echo "Error: No gateway found for $PRIMARY_INTERFACE in $LEASE_FILE_PRIMARY."
    exit 1
fi

if [[ -n "$SECONDARY_INTERFACE" && -z "$GATEWAY_SECONDARY" ]]; then
    echo "Error: No gateway found for $SECONDARY_INTERFACE in $LEASE_FILE_SECONDARY."
    exit 1
fi

echo "Primary gateway found: $GATEWAY_PRIMARY"
if [[ -n "$SECONDARY_INTERFACE" ]]; then
    echo "Secondary gateway found: $GATEWAY_SECONDARY"
fi

# Delete the current default route
echo "Deleting existing default route..."
sudo ip route del default || echo "No existing default route to delete."

# Add the new default route for the primary interface
echo "Setting new default route via $GATEWAY_PRIMARY on $PRIMARY_INTERFACE..."
sudo ip route add default via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"

# Set specific routes for monitoring IPs
echo "Adding static routes for monitoring IPs..."
sudo ip route add 8.8.4.4 via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
if [[ -n "$SECONDARY_INTERFACE" ]]; then
    sudo ip route add 1.0.0.1 via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
fi

# Confirm the routing table
echo "Updated routing table:"
ip route show


