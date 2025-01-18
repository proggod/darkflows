#!/bin/bash

# ==========================
# Enhanced WAN Monitoring and Failover Script
# ==========================

# Configuration File Path
CONFIG_FILE="/etc/darkflows/d_network.cfg"

# Monitoring IPs
PRIMARY_MONITOR="8.8.4.4"
SECONDARY_MONITOR="1.0.0.1"
ADDITIONAL_MONITOR="8.8.8.8"  # Added for comprehensive checks

# Ping thresholds and interval
PING_COUNT=5
PING_TIMEOUT=1
CHECK_INTERVAL=30

# Log file
LOG_FILE="/var/log/wann-monitor.log"

# Initialize current_interface to PRIMARY_INTERFACE
current_interface=""  # Will be set after sourcing config

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

# Function to check if a default route exists
default_route_exists() {
    ip route | grep -q '^default'
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

# Function to switch default route atomically
switch_to_interface() {
    local new_interface="$1"
    local gateway="$2"
    local new_bandwidth="$3"
    local new_ingress_bandwidth="$4"

    log "Attempting to switch to gateway $gateway on $new_interface..."

    # Test connectivity to the gateway
    if ping -c 3 -W 2 "$gateway" > /dev/null 2>&1; then
        log "Gateway $gateway is reachable. Proceeding with switch."

        # Replace the default route atomically
        if ip route replace default via "$gateway" dev "$new_interface"; then
            log "Default route successfully switched to $new_interface via $gateway."
            update_ifb0 "$current_interface" "$new_interface" "$new_ingress_bandwidth"
            configure_cake_egress "$new_interface" "$new_bandwidth"
            current_interface="$new_interface"
        else
            log "Error: Failed to switch default route to $new_interface via $gateway."
        fi
    else
        log "Error: Gateway $gateway is not reachable. Switch aborted."
    fi
}

# Function to reset the default route to a specific gateway without switching interfaces
reset_default_route() {
    local gateway="$1"
    local interface="$2"
    local new_bandwidth="$3"

    log "Attempting to reset default route to $gateway on $interface..."

    if ping -c 3 -W 2 "$gateway" > /dev/null 2>&1; then
        log "Gateway $gateway is reachable. Proceeding to reset default route."
        if ip route replace default via "$gateway" dev "$interface"; then
            log "Default route successfully reset to $interface via $gateway."
            update_ifb0 "$current_interface" "$interface" "$new_bandwidth"
            configure_cake_egress "$interface" "$new_bandwidth"
            current_interface="$interface"
        else
            log "Error: Failed to reset default route to $interface via $gateway."
        fi
    else
        log "Error: Gateway $gateway is not reachable. Cannot reset default route."
    fi
}

# Function to get the current default gateway and interface
get_current_gateway() {
    ip route | grep '^default' | awk '{print $3, $5}'
}

# Initialize log file
touch "$LOG_FILE"
log "===== Enhanced WAN Monitoring Script Started ====="

# Load and validate configuration
load_config
validate_config

# Set initial current_interface to PRIMARY_INTERFACE
current_interface="$PRIMARY_INTERFACE"

# Main loop
while true; do
    # Extract gateways from lease files
    PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"

    PRIMARY_GATEWAY=$(get_gateway "$PRIMARY_LEASE_FILE")
    SECONDARY_GATEWAY=$(get_gateway "$SECONDARY_LEASE_FILE")

    # Validate gateways
    if [[ -z "$PRIMARY_GATEWAY" || -z "$SECONDARY_GATEWAY" ]]; then
        log "Error: Unable to retrieve gateways from lease files."
        sleep "$CHECK_INTERVAL"
        continue
    fi

    log "Primary Gateway: $PRIMARY_GATEWAY"
    log "Secondary Gateway: $SECONDARY_GATEWAY"

    # Check if default route exists
    if default_route_exists; then
        log "Default route exists."

        # Get current default gateway and interface
        read -r CURRENT_GATEWAY CURRENT_INTERFACE <<< "$(get_current_gateway)"
        log "Current Default Gateway: $CURRENT_GATEWAY via $CURRENT_INTERFACE"

        # Check if current default gateway matches the expected gateway based on current_interface
        if [[ "$CURRENT_INTERFACE" == "$PRIMARY_INTERFACE" && "$CURRENT_GATEWAY" != "$PRIMARY_GATEWAY" ]]; then
            log "Mismatch detected: Current default gateway does not match Primary Gateway."
            reset_default_route "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$PRIMARY_EGRESS_BANDWIDTH"
        elif [[ "$CURRENT_INTERFACE" == "$SECONDARY_INTERFACE" && "$CURRENT_GATEWAY" != "$SECONDARY_GATEWAY" ]]; then
            log "Mismatch detected: Current default gateway does not match Secondary Gateway."
            reset_default_route "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" "$SECONDARY_EGRESS_BANDWIDTH"
        fi

    else
        log "Default route is missing. Attempting to set up Primary WAN as default."
        if [[ -n "$PRIMARY_GATEWAY" ]]; then
            log "Setting default route to Primary Gateway: $PRIMARY_GATEWAY on $PRIMARY_INTERFACE."
            reset_default_route "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$PRIMARY_EGRESS_BANDWIDTH"
        else
            log "Primary Gateway is not available. Initiating failover to Secondary WAN."
            if [[ -n "$SECONDARY_GATEWAY" ]]; then
                switch_to_interface "$SECONDARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_EGRESS_BANDWIDTH" "$SECONDARY_INGRESS_BANDWIDTH"
            else
                log "Error: No gateways available. Cannot set default route."
            fi
        fi
    fi

    # Perform ping checks
    # Test primary WAN by pinging PRIMARY_MONITOR
    if ! ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$PRIMARY_MONITOR" > /dev/null 2>&1; then
        log "Primary WAN is down (no ping responses to $PRIMARY_MONITOR)."

        if [[ "$current_interface" != "$SECONDARY_INTERFACE" ]]; then
            log "Switching to Secondary WAN..."
            switch_to_interface "$SECONDARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_EGRESS_BANDWIDTH" "$SECONDARY_INGRESS_BANDWIDTH"
        else
            log "Already using Secondary WAN. Checking its health..."
            if ! ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$SECONDARY_MONITOR" > /dev/null 2>&1; then
                log "Secondary WAN is also down (no ping responses to $SECONDARY_MONITOR)."
            else
                log "Secondary WAN is healthy and currently in use."
            fi
        fi
    else
        log "Primary WAN is healthy."

        if [[ "$current_interface" != "$PRIMARY_INTERFACE" ]]; then
            log "Attempting to switch back to Primary WAN..."

            # Ensure primary gateway is reachable before switching
            if ping -c 3 -W 2 "$PRIMARY_MONITOR" > /dev/null 2>&1; then
                switch_to_interface "$PRIMARY_INTERFACE" "$PRIMARY_GATEWAY" "$PRIMARY_EGRESS_BANDWIDTH" "$PRIMARY_INGRESS_BANDWIDTH"
            else
                log "Primary WAN is still unreachable. Continuing to use $current_interface."
            fi
        else
            log "Already using Primary WAN. No action needed."
        fi
    fi

    # Additional Ping Check to Determine Route Integrity
    if ping -c 2 -W 1 "$ADDITIONAL_MONITOR" > /dev/null 2>&1; then
        log "Additional Monitor ($ADDITIONAL_MONITOR) is reachable."
    else
        log "Additional Monitor ($ADDITIONAL_MONITOR) is NOT reachable."

        if ping -c 2 -W 1 "$PRIMARY_MONITOR" > /dev/null 2>&1; then
            log "Primary Monitor ($PRIMARY_MONITOR) is reachable but Additional Monitor ($ADDITIONAL_MONITOR) is not."
            log "Possible default route misconfiguration detected. Resetting default route."

            if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]]; then
                reset_default_route "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$PRIMARY_EGRESS_BANDWIDTH"
            elif [[ "$current_interface" == "$SECONDARY_INTERFACE" ]]; then
                reset_default_route "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" "$SECONDARY_EGRESS_BANDWIDTH"
            fi
        else
            log "Both Primary Monitor and Additional Monitor are not reachable. No immediate action taken."
        fi
    fi

    # Sleep before next check
    sleep "$CHECK_INTERVAL"
done


