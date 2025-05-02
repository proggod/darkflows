#!/bin/bash

# Enhanced Default Route Setup Script
# This script intelligently sets up default routes and monitoring routes
# after testing actual connectivity

# Source the network configuration file
source /etc/darkflows/d_network.cfg

# Define monitoring IPs (keep these in sync with the monitor script)
PRIMARY_MONITOR="8.8.4.4"
SECONDARY_MONITOR="1.0.0.1"
ADDITIONAL_MONITOR="8.8.8.8"

# Define the lease file paths for primary and secondary interfaces
LEASE_FILE_PRIMARY="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
LEASE_FILE_SECONDARY="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"

# Setup logging
LOG_FILE="/var/log/route-setup.log"
log() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

log "===== Enhanced Default Route Setup Script Started ====="

# Function to extract the gateway from a lease file
get_gateway() {
    local lease_file="$1"
    if [[ -f "$lease_file" ]]; then
        grep 'option routers' "$lease_file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

# Function to test if an IP is reachable through a specific interface
test_connectivity() {
    local ip="$1"
    local interface="$2"
    local count="${3:-3}"
    local timeout="${4:-2}"
    
    # Use ping with specific interface
    ping -c "$count" -W "$timeout" -I "$interface" "$ip" > /dev/null 2>&1
    return $?
}

# Function to clean up existing routes
clean_routes() {
    # Delete the current default route(s)
    log "Deleting existing default route(s)..."
    ip route | grep "^default" | while read -r route; do
        log "Removing route: $route"
        ip route del $route
    done

    # Clean up monitoring routes if they exist
    log "Cleaning up existing monitoring routes..."
    ip route del "$PRIMARY_MONITOR" 2>/dev/null || true
    ip route del "$SECONDARY_MONITOR" 2>/dev/null || true
    ip route del "$ADDITIONAL_MONITOR" 2>/dev/null || true
}

# Get gateways for both interfaces
GATEWAY_PRIMARY=$(get_gateway "$LEASE_FILE_PRIMARY")
GATEWAY_SECONDARY=$(get_gateway "$LEASE_FILE_SECONDARY")

# Check if gateways were found
if [[ -z "$GATEWAY_PRIMARY" ]]; then
    log "Error: No gateway found for $PRIMARY_INTERFACE in $LEASE_FILE_PRIMARY."
    exit 1
fi

if [[ -n "$SECONDARY_INTERFACE" && -z "$GATEWAY_SECONDARY" ]]; then
    log "Error: No gateway found for $SECONDARY_INTERFACE in $LEASE_FILE_SECONDARY."
    exit 1
fi

log "Primary gateway found: $GATEWAY_PRIMARY on $PRIMARY_INTERFACE"
if [[ -n "$SECONDARY_INTERFACE" ]]; then
    log "Secondary gateway found: $GATEWAY_SECONDARY on $SECONDARY_INTERFACE"
fi

# Clean up existing routes
clean_routes

# Test connectivity of primary interface
log "Testing connectivity on primary interface $PRIMARY_INTERFACE..."
PRIMARY_GATEWAY_REACHABLE=false
PRIMARY_INTERNET_REACHABLE=false

# First check if we can reach the gateway
if test_connectivity "$GATEWAY_PRIMARY" "$PRIMARY_INTERFACE" 2 1; then
    log "Primary gateway $GATEWAY_PRIMARY is reachable via $PRIMARY_INTERFACE."
    PRIMARY_GATEWAY_REACHABLE=true
    
    # Temporarily set up a route to PRIMARY_MONITOR via primary interface
    log "Setting temporary route to test internet connectivity on primary..."
    ip route add "$PRIMARY_MONITOR" via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
    
    # Test if we can reach the internet via primary
    if test_connectivity "$PRIMARY_MONITOR" "$PRIMARY_INTERFACE" 3 2; then
        log "Internet is reachable via primary interface ($PRIMARY_INTERFACE)."
        PRIMARY_INTERNET_REACHABLE=true
    else
        log "Internet is NOT reachable via primary interface ($PRIMARY_INTERFACE)."
        # Clean up the temporary route
        ip route del "$PRIMARY_MONITOR" 2>/dev/null || true
    fi
else
    log "Primary gateway $GATEWAY_PRIMARY is NOT reachable via $PRIMARY_INTERFACE."
fi

# Test connectivity of secondary interface if available
SECONDARY_GATEWAY_REACHABLE=false
SECONDARY_INTERNET_REACHABLE=false

if [[ -n "$SECONDARY_INTERFACE" ]]; then
    log "Testing connectivity on secondary interface $SECONDARY_INTERFACE..."
    
    # First check if we can reach the gateway
    if test_connectivity "$GATEWAY_SECONDARY" "$SECONDARY_INTERFACE" 2 1; then
        log "Secondary gateway $GATEWAY_SECONDARY is reachable via $SECONDARY_INTERFACE."
        SECONDARY_GATEWAY_REACHABLE=true
        
        # Temporarily set up a route to SECONDARY_MONITOR via secondary interface
        log "Setting temporary route to test internet connectivity on secondary..."
        ip route add "$SECONDARY_MONITOR" via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
        
        # Test if we can reach the internet via secondary
        if test_connectivity "$SECONDARY_MONITOR" "$SECONDARY_INTERFACE" 3 2; then
            log "Internet is reachable via secondary interface ($SECONDARY_INTERFACE)."
            SECONDARY_INTERNET_REACHABLE=true
        else
            log "Internet is NOT reachable via secondary interface ($SECONDARY_INTERFACE)."
            # Clean up the temporary route
            ip route del "$SECONDARY_MONITOR" 2>/dev/null || true
        fi
    else
        log "Secondary gateway $GATEWAY_SECONDARY is NOT reachable via $SECONDARY_INTERFACE."
    fi
fi

# Setup primary as default if it has internet
if [[ "$PRIMARY_INTERNET_REACHABLE" == true ]]; then
    log "Setting up primary interface as default route..."
    ip route add default via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
    
    # Set up monitoring routes via primary
    log "Setting up monitoring routes via primary interface..."
    ip route add "$PRIMARY_MONITOR" via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
    ip route add "$ADDITIONAL_MONITOR" via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
    
    # Also set up monitoring route for secondary monitor via secondary if available
    if [[ "$SECONDARY_GATEWAY_REACHABLE" == true ]]; then
        log "Setting up secondary monitoring route via secondary interface..."
        ip route add "$SECONDARY_MONITOR" via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
    fi
    
    log "Primary interface successfully configured as default route with monitoring routes."
    
# Fall back to secondary if primary doesn't have internet but secondary does
elif [[ "$SECONDARY_INTERNET_REACHABLE" == true ]]; then
    log "Primary interface has no internet. Setting up secondary interface as default route..."
    ip route add default via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
    
    # Set up monitoring routes via secondary
    log "Setting up monitoring routes via secondary interface..."
    ip route add "$SECONDARY_MONITOR" via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
    ip route add "$ADDITIONAL_MONITOR" via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
    
    log "Secondary interface successfully configured as default route with monitoring routes."

# If neither interface has internet but gateways are reachable, set primary as default
elif [[ "$PRIMARY_GATEWAY_REACHABLE" == true ]]; then
    log "No internet connectivity detected. Setting up primary interface as default route anyway..."
    ip route add default via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE"
    log "Warning: Gateway is reachable but internet connectivity was not detected."

# Last resort, try secondary gateway if primary gateway is not even reachable
elif [[ "$SECONDARY_GATEWAY_REACHABLE" == true ]]; then
    log "Primary gateway unreachable. Setting up secondary interface as default route..."
    ip route add default via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE"
    log "Warning: Primary gateway unreachable. Using secondary, but internet connectivity was not detected."

# Neither gateway is reachable, this is a serious problem
else
    log "ERROR: Neither primary nor secondary gateway is reachable. Cannot set default route."
    exit 1
fi

# Add fallback route with higher metric if we have two working interfaces
if [[ "$PRIMARY_INTERNET_REACHABLE" == true && "$SECONDARY_INTERNET_REACHABLE" == true ]]; then
    if ip route | grep -q "^default via $GATEWAY_PRIMARY"; then
        log "Adding secondary interface as fallback route with higher metric..."
        ip route add default via "$GATEWAY_SECONDARY" dev "$SECONDARY_INTERFACE" metric 200
    else
        log "Adding primary interface as fallback route with higher metric..."
        ip route add default via "$GATEWAY_PRIMARY" dev "$PRIMARY_INTERFACE" metric 200
    fi
fi

# Confirm the routing table
log "Updated routing table:"
ip route show

log "===== Enhanced Default Route Setup Complete ====="

# Exit with success
exit 0

