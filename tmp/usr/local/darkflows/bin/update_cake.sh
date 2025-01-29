#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Set CAKE parameters (default to empty string if not defined)
COMMON_CAKE_PARAMS="${CAKE_PARAMS:-}"

# Function to validate bandwidth value (case-insensitive)
validate_bandwidth() {
    local bandwidth=$1
    if [[ -z "$bandwidth" ]]; then
        echo "Error: Bandwidth value is empty."
        return 1
    fi
    if ! [[ "$bandwidth" =~ ^[0-9]+(\.[0-9]+)?[KMGTkmgt]?bit$ ]]; then
        echo "Error: Invalid bandwidth format. Expected format: e.g., 100Mbit, 1Gbit, 2.5gbit."
        return 1
    fi
    return 0
}

# Function to get the current default gateway and interface
get_current_gateway() {
    ip route | grep '^default' | awk '{print $3, $5}'
}

# Function to determine the active connection (PRIMARY or SECONDARY)
get_active_connection() {
    # Extract gateways from lease files
    PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"

    PRIMARY_GATEWAY=$(grep 'option routers' "$PRIMARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')
    SECONDARY_GATEWAY=$(grep 'option routers' "$SECONDARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')

    # Get current default gateway and interface
    read -r CURRENT_GATEWAY CURRENT_INTERFACE <<< "$(get_current_gateway)"

    # Determine which connection is active
    if [[ "$CURRENT_GATEWAY" == "$PRIMARY_GATEWAY" && "$CURRENT_INTERFACE" == "$PRIMARY_INTERFACE" ]]; then
        echo "PRIMARY"
    elif [[ "$CURRENT_GATEWAY" == "$SECONDARY_GATEWAY" && "$CURRENT_INTERFACE" == "$SECONDARY_INTERFACE" ]]; then
        echo "SECONDARY"
    else
        echo "UNKNOWN"
    fi
}

# Function to change CAKE bandwidth
change_cake_bandwidth() {
    # Validate bandwidth values
    if ! validate_bandwidth "$PRIMARY_EGRESS_BANDWIDTH"; then
        echo "Failed to validate PRIMARY_EGRESS_BANDWIDTH."
        exit 1
    fi
    if [ -n "$SECONDARY_INTERFACE" ] && ! validate_bandwidth "$SECONDARY_EGRESS_BANDWIDTH"; then
        echo "Failed to validate SECONDARY_EGRESS_BANDWIDTH."
        exit 1
    fi
    if ! validate_bandwidth "$PRIMARY_INGRESS_BANDWIDTH"; then
        echo "Failed to validate PRIMARY_INGRESS_BANDWIDTH."
        exit 1
    fi
    if [ -n "$SECONDARY_INTERFACE" ] && ! validate_bandwidth "$SECONDARY_INGRESS_BANDWIDTH"; then
        echo "Failed to validate SECONDARY_INGRESS_BANDWIDTH."
        exit 1
    fi
    if ! validate_bandwidth "$INTERNAL_EGRESS_BANDWIDTH"; then
        echo "Failed to validate INTERNAL_EGRESS_BANDWIDTH."
        exit 1
    fi

    # Determine the active connection
    ACTIVE_CONNECTION=$(get_active_connection)
    if [[ "$ACTIVE_CONNECTION" == "UNKNOWN" ]]; then
        echo "Error: Unable to determine active connection."
        exit 1
    fi

    echo "Active connection: $ACTIVE_CONNECTION"

    # Set ingress bandwidth based on the active connection
    if [[ "$ACTIVE_CONNECTION" == "PRIMARY" ]]; then
        INGRESS_BANDWIDTH="$PRIMARY_INGRESS_BANDWIDTH"
    else
        INGRESS_BANDWIDTH="$SECONDARY_INGRESS_BANDWIDTH"
    fi

    # Change bandwidth for egress traffic on the primary interface
    echo "Changing CAKE bandwidth for egress traffic on $PRIMARY_INTERFACE to ${PRIMARY_EGRESS_BANDWIDTH}..."
    tc qdisc replace dev $PRIMARY_INTERFACE root cake bandwidth ${PRIMARY_EGRESS_BANDWIDTH} $COMMON_CAKE_PARAMS || { echo "Failed to change CAKE bandwidth on $PRIMARY_INTERFACE"; exit 1; }

    # Change bandwidth for egress traffic on the secondary interface (if configured)
    if [ -n "$SECONDARY_INTERFACE" ]; then
        echo "Changing CAKE bandwidth for egress traffic on $SECONDARY_INTERFACE to ${SECONDARY_EGRESS_BANDWIDTH}..."
        tc qdisc replace dev $SECONDARY_INTERFACE root cake bandwidth ${SECONDARY_EGRESS_BANDWIDTH} $COMMON_CAKE_PARAMS || { echo "Failed to change CAKE bandwidth on $SECONDARY_INTERFACE"; exit 1; }
    fi

    # Change bandwidth for ingress traffic on ifb0
    echo "Changing CAKE bandwidth for ingress traffic on ifb0 to ${INGRESS_BANDWIDTH}..."
    tc qdisc replace dev ifb0 root handle 1: cake bandwidth ${INGRESS_BANDWIDTH} $COMMON_CAKE_PARAMS || { echo "Failed to change CAKE bandwidth on ifb0"; exit 1; }

    # Change bandwidth for local traffic on the internal interface
    echo "Changing CAKE bandwidth for local traffic on $INTERNAL_INTERFACE to ${INTERNAL_EGRESS_BANDWIDTH}..."
    tc qdisc replace dev $INTERNAL_INTERFACE root cake bandwidth ${INTERNAL_EGRESS_BANDWIDTH} $COMMON_CAKE_PARAMS || { echo "Failed to change CAKE bandwidth on $INTERNAL_INTERFACE"; exit 1; }
}

# Main script logic
echo "Changing CAKE bandwidth..."
change_cake_bandwidth

echo "CAKE bandwidth change completed successfully."

# Verify CAKE configuration
echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev $SECONDARY_INTERFACE
fi


