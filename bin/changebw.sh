#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Set CAKE parameters (default to empty string if not defined)
CAKE_PARAMS="${CAKE_PARAMS:-}"

# Update PRIMARY_INTERFACE bandwidth settings
echo "Updating bandwidth for $PRIMARY_INTERFACE (egress)..."
tc qdisc change dev $PRIMARY_INTERFACE root cake bandwidth ${PRIMARY_EGRESS_BANDWIDTH} ${CAKE_PARAMS}

# Update IFB0 (ingress) bandwidth settings
echo "Updating bandwidth for ifb0 (ingress)..."
echo "----------------------------------------"
echo tc qdisc change dev ifb0 root cake bandwidth ${PRIMARY_INGRESS_BANDWIDTH} ${CAKE_PARAMS}
echo "----------------------------------------"
tc qdisc change dev ifb0 root cake bandwidth ${PRIMARY_INGRESS_BANDWIDTH} ${CAKE_PARAMS}
echo "----------------------------------------"

# Update INTERNAL_INTERFACE bandwidth settings
echo "Updating bandwidth for $INTERNAL_INTERFACE..."
tc qdisc change dev $INTERNAL_INTERFACE root cake bandwidth ${INTERNAL_EGRESS_BANDWIDTH} ${CAKE_PARAMS}

# Update SECONDARY_INTERFACE bandwidth settings if it exists
if [ -n "$SECONDARY_INTERFACE" ]; then
    echo "Updating bandwidth for $SECONDARY_INTERFACE..."
    tc qdisc change dev $SECONDARY_INTERFACE root cake bandwidth ${SECONDARY_EGRESS_BANDWIDTH} ${CAKE_PARAMS}
fi

# Show updated configuration
echo "### Current CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
[ -n "$SECONDARY_INTERFACE" ] && tc -s qdisc show dev $SECONDARY_INTERFACE

echo "Bandwidth settings updated successfully."

