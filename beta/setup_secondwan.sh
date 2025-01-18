#!/bin/bash
#
# setup_secondwan.sh
#
# Loads /etc/darkflows/d_network.cfg to get SECONDARY_INTERFACE, attempts to
# parse the gateway from /var/lib/dhcp/dhclient.SECONDARY_INTERFACE.leases,
# and sets up a policy routing table (table=200) with that default route.
#
# This mimics the gateway detection logic used in switch_gateway.sh.

CONFIG_FILE="/etc/darkflows/d_network.cfg"
LEASE_DIR="/var/lib/dhcp"  # Typically where dhclient lease files go
TABLE_ID=200
LOG_FILE="/var/log/setup_secondwan.log"

# Function to log messages to console + a log file
log() {
    local msg="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $msg" | tee -a "$LOG_FILE"
}

# Load config
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
    log "Loaded config from $CONFIG_FILE"
else
    log "Error: Cannot find $CONFIG_FILE"
    exit 1
fi

# Validate that SECONDARY_INTERFACE is set
if [[ -z "$SECONDARY_INTERFACE" ]]; then
    log "Error: SECONDARY_INTERFACE not found in $CONFIG_FILE"
    exit 1
fi

# Build the lease file path for the secondary interface
LEASE_FILE="$LEASE_DIR/dhclient.${SECONDARY_INTERFACE}.leases"

# Function: extract gateway from lease file
get_gateway_from_lease() {
    local file="$1"
    if [[ -f "$file" ]]; then
        # Grab the last 'option routers' line, parse the 3rd field, strip trailing semicolon
        grep 'option routers' "$file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

# Attempt to get the gateway
SECONDARY_GATEWAY="$(get_gateway_from_lease "$LEASE_FILE")"

if [[ -z "$SECONDARY_GATEWAY" ]]; then
    log "Error: Could not determine gateway from $LEASE_FILE"
    log "Ensure $SECONDARY_INTERFACE has a DHCP lease or update this script to hard-code your gateway."
    exit 1
fi

log "Found secondary gateway $SECONDARY_GATEWAY for interface $SECONDARY_INTERFACE"

# Flush old routes in table 200 (optional)
log "Flushing old routes in table $TABLE_ID..."
# Only flush if table 200 has any routes
if ip route show table "$TABLE_ID" >/dev/null 2>&1; then
    ip route flush table "$TABLE_ID"
fi


# Add a default route in table 200
log "Adding default via $SECONDARY_GATEWAY dev $SECONDARY_INTERFACE to table $TABLE_ID"
ip route add default via "$SECONDARY_GATEWAY" dev "$SECONDARY_INTERFACE" table $TABLE_ID || {
    log "Error: Failed to add default route in table $TABLE_ID"
    exit 1
}

# Show results
log "Current routes in table $TABLE_ID:"
ip route show table $TABLE_ID

log "Done. To route an IP via $SECONDARY_INTERFACE, do e.g.:"
log "  ip rule add from 192.168.0.159 table $TABLE_ID priority 100"
log "And ensure NAT on $SECONDARY_INTERFACE, e.g.:"
log "  nft add rule ip nat postrouting oif \"$SECONDARY_INTERFACE\" masquerade"
