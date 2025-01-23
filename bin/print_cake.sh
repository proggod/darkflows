#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev $SECONDARY_INTERFACE
fi


