#!/bin/bash

# ==========================
# Current Connection Detection Script
# ==========================

# Configuration File Path
CONFIG_FILE="/etc/darkflows/d_network.cfg"

# Log file
LOG_FILE="/var/log/get_current_connection.log"

# Function to log messages to both console and log file
log() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

# Function to load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        log "Configuration loaded from $CONFIG_FILE."
    else
        log "Error: Configuration file $CONFIG_FILE not found."
        exit 1
    fi
}

# Function to validate configuration variables
validate_config() {
    # Check primary interface settings
    if [[ -z "$PRIMARY_INTERFACE" || -z "$PRIMARY_EGRESS_BANDWIDTH" || -z "$PRIMARY_INGRESS_BANDWIDTH" ]]; then
        log "Error: Incomplete Primary Interface configuration."
        exit 1
    fi

    # Check secondary interface settings
    if [[ -z "$SECONDARY_INTERFACE" || -z "$SECONDARY_EGRESS_BANDWIDTH" || -z "$SECONDARY_INGRESS_BANDWIDTH" ]]; then
        log "Error: Incomplete Secondary Interface configuration."
        exit 1
    fi
}

# Function to extract gateway from lease file
get_gateway() {
    local lease_file="$1"
    if [[ -f "$lease_file" ]]; then
        # Extract the last 'option routers' entry
        grep 'option routers' "$lease_file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

# Function to get the current default gateway and interface
get_current_gateway() {
    ip route | grep '^default' | awk '{print $3, $5}'
}

# Initialize log file
touch "$LOG_FILE"
log "===== Current Connection Detection Script Started ====="

# Load and validate configuration
load_config
validate_config

# Extract gateways from lease files
PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"

PRIMARY_GATEWAY=$(get_gateway "$PRIMARY_LEASE_FILE")
SECONDARY_GATEWAY=$(get_gateway "$SECONDARY_LEASE_FILE")

# Validate gateways
if [[ -z "$PRIMARY_GATEWAY" || -z "$SECONDARY_GATEWAY" ]]; then
    log "Error: Unable to retrieve gateways from lease files."
    exit 1
fi

log "Primary Gateway: $PRIMARY_GATEWAY"
log "Secondary Gateway: $SECONDARY_GATEWAY"

# Get current default gateway and interface
read -r CURRENT_GATEWAY CURRENT_INTERFACE <<< "$(get_current_gateway)"
log "Current Default Gateway: $CURRENT_GATEWAY via $CURRENT_INTERFACE"

# Determine which connection is currently being used
if [[ "$CURRENT_GATEWAY" == "$PRIMARY_GATEWAY" && "$CURRENT_INTERFACE" == "$PRIMARY_INTERFACE" ]]; then
    echo "PRIMARY"
    log "Current connection: PRIMARY"
elif [[ "$CURRENT_GATEWAY" == "$SECONDARY_GATEWAY" && "$CURRENT_INTERFACE" == "$SECONDARY_INTERFACE" ]]; then
    echo "SECONDARY"
    log "Current connection: SECONDARY"
else
    echo "UNKNOWN"
    log "Error: Current connection does not match PRIMARY or SECONDARY."
    exit 1
fi

log "Current connection detection completed."


