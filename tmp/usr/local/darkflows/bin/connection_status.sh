#!/bin/bash

CONFIG_FILE="/etc/darkflows/d_network.cfg"
LOG_FILE="/var/log/get_current_connection.log"

log() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        log "Configuration loaded from $CONFIG_FILE."
    else
        log "Error: Configuration file $CONFIG_FILE not found."
        exit 1
    fi
}

validate_config() {
    if [ -z "$PRIMARY_INTERFACE" ] || [ -z "$PRIMARY_EGRESS_BANDWIDTH" ] || [ -z "$PRIMARY_INGRESS_BANDWIDTH" ]; then
        log "Error: Incomplete Primary Interface configuration."
        exit 1
    fi

    if [ -z "$SECONDARY_INTERFACE" ] || [ -z "$SECONDARY_EGRESS_BANDWIDTH" ] || [ -z "$SECONDARY_INGRESS_BANDWIDTH" ]; then
        log "Warning: Incomplete or missing Secondary Interface configuration. Running in primary-only mode."
    fi
}

get_gateway() {
    local lease_file="$1"
    if [ -f "$lease_file" ]; then
        grep 'option routers' "$lease_file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

get_current_gateway() {
    ip route | grep '^default' | awk '{print $3, $5}'
}

touch "$LOG_FILE"
log "===== Current Connection Detection Script Started ====="

load_config
validate_config

PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
PRIMARY_GATEWAY=$(get_gateway "$PRIMARY_LEASE_FILE")

if [ -n "$SECONDARY_INTERFACE" ]; then
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"
    SECONDARY_GATEWAY=$(get_gateway "$SECONDARY_LEASE_FILE")
    log "Secondary Gateway: $SECONDARY_GATEWAY"
fi

if [ -z "$PRIMARY_GATEWAY" ]; then
    log "Error: Unable to retrieve primary gateway from lease file."
    exit 1
fi

log "Primary Gateway: $PRIMARY_GATEWAY"

read -r CURRENT_GATEWAY CURRENT_INTERFACE <<< "$(get_current_gateway)"
log "Current Default Gateway: $CURRENT_GATEWAY via $CURRENT_INTERFACE"

if [ "$CURRENT_GATEWAY" = "$PRIMARY_GATEWAY" ] && [ "$CURRENT_INTERFACE" = "$PRIMARY_INTERFACE" ]; then
    echo "PRIMARY"
    log "Current connection: PRIMARY"
elif [ -n "$SECONDARY_INTERFACE" ] && [ "$CURRENT_GATEWAY" = "$SECONDARY_GATEWAY" ] && [ "$CURRENT_INTERFACE" = "$SECONDARY_INTERFACE" ]; then
    echo "SECONDARY"
    log "Current connection: SECONDARY"
else
    if [ -n "$SECONDARY_INTERFACE" ]; then
        echo "UNKNOWN"
        log "Error: Current connection does not match PRIMARY or SECONDARY."
        exit 1
    elif [ "$CURRENT_INTERFACE" != "$PRIMARY_INTERFACE" ]; then
        echo "UNKNOWN"
        log "Error: Current connection does not match PRIMARY interface."
        exit 1
    else
        echo "PRIMARY"
        log "Current connection: PRIMARY (running in primary-only mode)"
    fi
fi

log "Current connection detection completed."


