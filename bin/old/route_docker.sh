#!/bin/bash

# Enable debug mode if specified
DEBUG=0
CONFIG_FILE="/etc/darkflows/d_network.cfg"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

debug_print() {
    if [ $DEBUG -eq 1 ]; then
        echo -e "${BLUE}[DEBUG] $1${NC}" >&2
    fi
}

error_print() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    if [ "$2" != "continue" ]; then
        exit 1
    fi
}

success_print() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" >&2
}

warning_print() {
    echo -e "${YELLOW}[WARNING] $1${NC}" >&2
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS] [CONTAINER_NAME | -f FILE]
Options:
    -m, --mode      Forwarding mode: 'internal' or 'all' (default: internal)
    -d, --debug     Enable debug output (shows detailed progress and rules being added)
    -f, --file      Read container names and modes from file (format: container_name:mode)
    -h, --help      Show this help message

Examples:
    $0 -m internal gitlab                    # Forward ports from internal interface only
    $0 -m all gitlab -d                      # Forward from all interfaces with debug output
    $0 -f containers.txt                     # Process multiple containers from file
    
File format example (containers.txt):
    gitlab:all
    nextcloud:internal
    nginx:all
EOF
    exit 1
}

# Function to verify config file and source it
check_config() {
    debug_print "Checking for config file at $CONFIG_FILE"
    if [ ! -f "$CONFIG_FILE" ]; then
        error_print "Configuration file not found at $CONFIG_FILE"
    fi
    
    debug_print "Sourcing configuration file"
    source "$CONFIG_FILE" || error_print "Failed to source configuration file"
    
    # Verify required variables from config
    if [ -z "$INTERNAL_INTERFACE" ]; then
        error_print "INTERNAL_INTERFACE not defined in config"
    fi
    debug_print "Internal interface: $INTERNAL_INTERFACE"
}

# Function to get Docker container info
get_docker_info() {
    local container_name=$1
    debug_print "Getting info for container: $container_name"
    
    # Check if container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        error_print "Container '$container_name' not found or not running" "continue"
        return 1
    fi
    
    # Get container IP
    local container_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container_name")
    if [ -z "$container_ip" ]; then
        error_print "Failed to get IP address for container $container_name" "continue"
        return 1
    fi
    
    # Output IP first
    echo "$container_ip"
    
    # Get and process port mappings
    docker port "$container_name" | while read -r line; do
        local container_port=$(echo "$line" | cut -d'/' -f1)
        local protocol=$(echo "$line" | cut -d'/' -f2 | cut -d' ' -f1)
        local host_port=$(echo "$line" | cut -d':' -f2)
        echo "${host_port}:${container_port}:${protocol}"
    done
}

# Function to add forwarding rules
add_forwarding_rules() {
    local interface=$1
    local container_ip=$2
    local external_port=$3
    local internal_port=$4
    local protocol=$5
    
    debug_print "Adding $protocol forwarding rules for $interface -> $container_ip:$internal_port (external: $external_port)"
    
    # Add NAT prerouting rule
    if ! nft add rule ip nat prerouting iif "$interface" $protocol dport "$external_port" dnat to "$container_ip:$internal_port" 2>/dev/null; then
        warning_print "Failed to add NAT prerouting rule for $interface ($protocol) - may already exist"
    fi
    
    # Add forward rules
    if ! nft add rule inet filter forward iif "$interface" ip daddr "$container_ip" $protocol dport "$internal_port" accept 2>/dev/null; then
        warning_print "Failed to add forward rule (incoming) for $interface ($protocol) - may already exist"
    fi
    
    if ! nft add rule inet filter forward ip saddr "$container_ip" $protocol sport "$internal_port" ct state established accept 2>/dev/null; then
        warning_print "Failed to add forward rule (outgoing) for $interface ($protocol) - may already exist"
    fi
    
    # Add hairpin NAT
    local interface_ip=$(ip -4 addr show dev "$interface" | grep -oP '(?<=inet\s)\d+(\.\d+){3}')
    if [ -n "$interface_ip" ]; then
        if ! nft add rule ip nat postrouting ip daddr "$container_ip" $protocol dport "$internal_port" snat to "$interface_ip" 2>/dev/null; then
            warning_print "Failed to add hairpin NAT rule for $interface ($protocol) - may already exist"
        fi
    fi
    
    success_print "Added $protocol forwarding rules for $interface:$external_port -> $container_ip:$internal_port"
}

# Function to process a single container
process_container() {
    local container_name=$1
    local mode=$2
    
    debug_print "Processing container $container_name in $mode mode"
    
    # Get container info
    mapfile -t CONTAINER_INFO < <(get_docker_info "$container_name")
    if [ ${#CONTAINER_INFO[@]} -eq 0 ]; then
        error_print "Failed to get info for container $container_name" "continue"
        return 1
    fi
    
    CONTAINER_IP="${CONTAINER_INFO[0]}"
    success_print "Found container $container_name with IP $CONTAINER_IP"
    
    # Process port mappings (skip first line which is the IP)
    for ((i=1; i<${#CONTAINER_INFO[@]}; i++)); do
        mapping="${CONTAINER_INFO[$i]}"
        if [ -n "$mapping" ]; then
            external_port=$(echo "$mapping" | cut -d: -f1)
            internal_port=$(echo "$mapping" | cut -d: -f2)
            protocol=$(echo "$mapping" | cut -d: -f3)
            
            debug_print "Processing $protocol port mapping: $external_port -> $internal_port"
            
            # Add rules for internal interface
            add_forwarding_rules "$INTERNAL_INTERFACE" "$CONTAINER_IP" "$external_port" "$internal_port" "$protocol"
            
            # Add rules for primary and secondary interfaces if mode is 'all'
            if [ "$mode" = "all" ]; then
                add_forwarding_rules "$PRIMARY_INTERFACE" "$CONTAINER_IP" "$external_port" "$internal_port" "$protocol"
                
                if [ -n "$SECONDARY_INTERFACE" ]; then
                    add_forwarding_rules "$SECONDARY_INTERFACE" "$CONTAINER_IP" "$external_port" "$internal_port" "$protocol"
                fi
            fi
        fi
    done
    
    success_print "Completed processing container $container_name"
}

# Parse command line arguments
MODE="internal"
FILE_MODE=0
while [ $# -gt 0 ]; do
    case "$1" in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG=1
            debug_print "Debug mode enabled - will show detailed progress"
            shift
            ;;
        -f|--file)
            FILE_MODE=1
            CONFIG_FILE_PATH="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$CONTAINER_NAME" ]; then
                CONTAINER_NAME="$1"
            else
                error_print "Unknown argument: $1"
            fi
            shift
            ;;
    esac
done

# Validate inputs
if [ $FILE_MODE -eq 1 ]; then
    if [ ! -f "$CONFIG_FILE_PATH" ]; then
        error_print "Container config file not found: $CONFIG_FILE_PATH"
    fi
elif [ -z "$CONTAINER_NAME" ]; then
    usage
fi

# Main execution
debug_print "Starting port forwarding setup"
check_config

if [ $FILE_MODE -eq 1 ]; then
    # Process containers from file
    while IFS=: read -r container mode || [ -n "$container" ]; do
        # Skip empty lines and comments
        if [ -z "$container" ] || [[ "$container" == \#* ]]; then
            continue
        fi
        
        # Trim whitespace
        container=$(echo "$container" | tr -d '[:space:]')
        mode=$(echo "$mode" | tr -d '[:space:]')
        
        # Use default mode if none specified
        if [ -z "$mode" ]; then
            mode="internal"
        fi
        
        # Validate mode
        if [ "$mode" != "internal" ] && [ "$mode" != "all" ]; then
            warning_print "Invalid mode '$mode' for container '$container', using 'internal'"
            mode="internal"
        fi
        
        debug_print "Processing container '$container' with mode '$mode' from file"
        process_container "$container" "$mode"
    done < "$CONFIG_FILE_PATH"
else
    # Process single container from command line
    process_container "$CONTAINER_NAME" "$MODE"
fi

success_print "All container processing completed"

# Show final ruleset if in debug mode
if [ $DEBUG -eq 1 ]; then
    debug_print "Final nftables ruleset:"
    nft list ruleset
fi

