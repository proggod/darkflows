#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

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
    if ! validate_bandwidth "$INTERNAL_EGRESS_BANDWIDTH"; then
        echo "Failed to validate INTERNAL_EGRESS_BANDWIDTH."
        exit 1
    fi

    # Change bandwidth for egress traffic on the primary interface
    echo "Changing CAKE bandwidth for egress traffic on $PRIMARY_INTERFACE to ${PRIMARY_EGRESS_BANDWIDTH}..."
    tc qdisc replace dev $PRIMARY_INTERFACE root cake bandwidth ${PRIMARY_EGRESS_BANDWIDTH} nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to change CAKE bandwidth on $PRIMARY_INTERFACE"; exit 1; }

    # Change bandwidth for egress traffic on the secondary interface (if configured)
    if [ -n "$SECONDARY_INTERFACE" ]; then
        echo "Changing CAKE bandwidth for egress traffic on $SECONDARY_INTERFACE to ${SECONDARY_EGRESS_BANDWIDTH}..."
        tc qdisc replace dev $SECONDARY_INTERFACE root cake bandwidth ${SECONDARY_EGRESS_BANDWIDTH} nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to change CAKE bandwidth on $SECONDARY_INTERFACE"; exit 1; }
    fi

    # Change bandwidth for ingress traffic on ifb0
    echo "Changing CAKE bandwidth for ingress traffic on ifb0 to ${PRIMARY_INGRESS_BANDWIDTH}..."
    tc qdisc replace dev ifb0 root handle 1: cake bandwidth ${PRIMARY_INGRESS_BANDWIDTH} memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter nowash split-gso || { echo "Failed to change CAKE bandwidth on ifb0"; exit 1; }

    # Change bandwidth for local traffic on the internal interface
    echo "Changing CAKE bandwidth for local traffic on $INTERNAL_INTERFACE to ${INTERNAL_EGRESS_BANDWIDTH}..."
    tc qdisc replace dev $INTERNAL_INTERFACE root cake bandwidth ${INTERNAL_EGRESS_BANDWIDTH} memlimit 64mb besteffort rtt 50ms ack-filter split-gso || { echo "Failed to change CAKE bandwidth on $INTERNAL_INTERFACE"; exit 1; }
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

