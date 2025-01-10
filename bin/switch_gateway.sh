#!/bin/bash

# ==========================
# Gateway Switching Script
# ==========================

# Configuration File Path
CONFIG_FILE="/etc/darkflows/d_network.cfg"

# Log file
LOG_FILE="/var/log/switch_gateway.log"

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

# Function to configure ifb0 for ingress traffic shaping
update_ifb0() {
    local old_interface="$1"
    local new_interface="$2"
    local ingress_bandwidth="$3"

    log "Reconfiguring CAKE ingress for switch from $old_interface to $new_interface..."

    # Clear existing ifb0 and ingress configurations
    tc qdisc del dev ifb0 root > /dev/null 2>&1 || true
    tc qdisc del dev "$old_interface" ingress > /dev/null 2>&1 || true
    tc qdisc del dev "$new_interface" ingress > /dev/null 2>&1 || true

    # Attach ifb0 to new interface
    tc qdisc add dev "$new_interface" handle ffff: ingress
    tc filter replace dev "$new_interface" parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0
    tc qdisc add dev ifb0 root cake bandwidth "$ingress_bandwidth" memlimit 32mb diffserv4 rtt 50ms triple-isolate no-ack-filter

    log "CAKE ingress reconfigured for $new_interface."
}

# Function to configure CAKE for egress traffic
configure_cake_egress() {
    local interface="$1"
    local bandwidth="$2"

    log "Configuring CAKE egress for $interface with bandwidth $bandwidth..."
    tc qdisc del dev "$interface" root > /dev/null 2>&1 || true
    tc qdisc add dev "$interface" root cake bandwidth "$bandwidth" memlimit 32mb diffserv4 rtt 50ms triple-isolate no-ack-filter
    log "CAKE egress configured for $interface."
}

# Function to switch to a specific gateway
switch_gateway() {
    local connection_type="$1"

    # Determine the target interface, gateway, and bandwidth based on the connection type
    if [[ "$connection_type" == "PRIMARY" ]]; then
        local interface="$PRIMARY_INTERFACE"
        local lease_file="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
        local egress_bandwidth="$PRIMARY_EGRESS_BANDWIDTH"
        local ingress_bandwidth="$PRIMARY_INGRESS_BANDWIDTH"
    elif [[ "$connection_type" == "SECONDARY" ]]; then
        local interface="$SECONDARY_INTERFACE"
        local lease_file="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"
        local egress_bandwidth="$SECONDARY_EGRESS_BANDWIDTH"
        local ingress_bandwidth="$SECONDARY_INGRESS_BANDWIDTH"
    else
        log "Error: Invalid connection type. Use 'PRIMARY' or 'SECONDARY'."
        exit 1
    fi

    # Extract the gateway from the lease file
    local gateway=$(get_gateway "$lease_file")
    if [[ -z "$gateway" ]]; then
        log "Error: Unable to retrieve gateway for $connection_type interface."
        exit 1
    fi

    log "Switching to $connection_type gateway: $gateway on $interface..."

    # Test connectivity to the gateway
    if ping -c 3 -W 2 "$gateway" > /dev/null 2>&1; then
        log "Gateway $gateway is reachable. Proceeding with switch."

        # Replace the default route atomically
        if ip route replace default via "$gateway" dev "$interface"; then
            log "Default route successfully switched to $interface via $gateway."

            # Update ifb0 and CAKE configurations
            update_ifb0 "$current_interface" "$interface" "$ingress_bandwidth"
            configure_cake_egress "$interface" "$egress_bandwidth"
            current_interface="$interface"
        else
            log "Error: Failed to switch default route to $interface via $gateway."
        fi
    else
        log "Error: Gateway $gateway is not reachable. Switch aborted."
    fi
}

# Initialize log file
touch "$LOG_FILE"
log "===== Gateway Switching Script Started ====="

# Load and validate configuration
load_config
validate_config

# Set initial current_interface to PRIMARY_INTERFACE
current_interface="$PRIMARY_INTERFACE"

# Check if a connection type argument is provided
if [[ $# -ne 1 ]]; then
    log "Usage: $0 <PRIMARY|SECONDARY>"
    exit 1
fi

# Switch to the specified gateway
switch_gateway "$1"

log "Gateway switch completed."

