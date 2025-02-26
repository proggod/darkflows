#!/bin/bash
set -e

# Suppress nftables warnings
export NFT_NO_WARN=1

CONFIG_DIR="/etc/darkflows"
TARGET_FILE="${CONFIG_DIR}/external_forwards.txt"
ADD_SCRIPT="/usr/local/darkflows/bin/add_external_forward.sh"
REMOVE_SCRIPT="/usr/local/darkflows/bin/remove_external_forward.sh"

# Source network config
source "${CONFIG_DIR}/d_network.cfg" 2>/dev/null || {
    echo "Failed to source network config"
    exit 1
}

# Validate environment
[[ -f "$TARGET_FILE" ]] || { echo "Missing target file: $TARGET_FILE"; exit 1; }
[[ -x "$ADD_SCRIPT" ]] || { echo "Missing add script: $ADD_SCRIPT"; exit 1; }
[[ -x "$REMOVE_SCRIPT" ]] || { echo "Missing remove script: $REMOVE_SCRIPT"; exit 1; }

# Temporary files
ACTIVE_LIST=$(mktemp)
DESIRED_LIST=$(mktemp)
IP_SUBNETS=$(mktemp)
trap 'rm -f "$ACTIVE_LIST" "$DESIRED_LIST" "$IP_SUBNETS"' EXIT

echo "Identifying legitimate interfaces and subnets..."

# Get all interfaces including VLANs based on the main interfaces in config
relevant_interfaces=""
for iface in "$INTERNAL_INTERFACE" "$PRIMARY_INTERFACE" "$SECONDARY_INTERFACE"; do
    if [ -n "$iface" ]; then
        # Include the base interface
        relevant_interfaces="$relevant_interfaces $iface"
        
        # Include any VLANs on this interface (e.g., lan0.10, lan1.20, etc.)
        for vlan_iface in $(ip link show | grep -oE "${iface}\.[0-9]+" | sort -u); do
            if [ -n "$vlan_iface" ]; then
                relevant_interfaces="$relevant_interfaces $vlan_iface"
            fi
        done
    fi
done

echo "Relevant interfaces: $relevant_interfaces"

# Get subnets for all relevant interfaces
for iface in $relevant_interfaces; do
    # Extract subnet in CIDR notation
    subnet=$(ip -4 addr show dev "$iface" 2>/dev/null | grep -oE 'inet [0-9.]+/[0-9]+' | awk '{print $2}')
    if [ -n "$subnet" ]; then
        echo "Interface $iface has subnet $subnet"
        echo "$subnet" >> "$IP_SUBNETS"
    fi
done

# If we didn't find any subnets, exit with an error
if [ ! -s "$IP_SUBNETS" ]; then
    echo "Error: Could not determine any valid subnets from configured interfaces"
    exit 1
fi

echo "Listing active forwards..."

# Find all port forwards
all_forwards=$(nft list ruleset 2>/dev/null | grep -v "^#" | \
    grep -oE 'tcp dport ([0-9]+).*dnat to ([0-9.]+):([0-9]+)' | \
    sed -E 's/tcp dport ([0-9]+).*dnat to ([0-9.]+):([0-9]+)/\1:\2:\3/')

# Filter the forwards to only include IPs that are within our configured subnets
for forward in $all_forwards; do
    IFS=: read -r ext_port target_ip int_port <<< "$forward"
    
    # Check if the target IP is in any of our subnets
    is_in_subnet=0
    
    while read -r subnet; do
        # Extract subnet base and mask
        IFS=/ read -r net_base mask <<< "$subnet"
        
        # Convert IP address to its network component
        IFS=. read -r a b c d <<< "$net_base"
        net_addr=$(( (a << 24) + (b << 16) + (c << 8) + d ))
        
        # Create subnet mask
        mask_bin=$((0xffffffff << (32 - mask)))
        
        # Convert target IP to binary
        IFS=. read -r a b c d <<< "$target_ip"
        ip_addr=$(( (a << 24) + (b << 16) + (c << 8) + d ))
        
        # Check if IP is in subnet
        if [ $(( (ip_addr & mask_bin) )) -eq $(( (net_addr & mask_bin) )) ]; then
            is_in_subnet=1
            break
        fi
    done < "$IP_SUBNETS"
    
    # If this IP is in our subnets, add it to the active list
    if [ $is_in_subnet -eq 1 ]; then
        echo "$forward" >> "$ACTIVE_LIST"
    else
        echo "Ignoring forward to $target_ip (not in our configured subnets)"
    fi
done

# Sort and remove duplicates
if [ -s "$ACTIVE_LIST" ]; then
    sort -u "$ACTIVE_LIST" -o "$ACTIVE_LIST"
fi

echo "Active forwards on our interfaces: $(wc -l < "$ACTIVE_LIST")"

# Parse desired forwards
echo "Reading desired configuration..."
grep -vE '^#|^$' "$TARGET_FILE" | \
    awk 'BEGIN {FS=":"} 
    $1 ~ /^[0-9]+$/ && 
    $2 ~ /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/ && 
    $3 ~ /^[0-9]+$/ {print $1":"$2":"$3}' | \
    sort > "$DESIRED_LIST"

echo "Desired forwards: $(wc -l < "$DESIRED_LIST")"

echo "Synchronizing forwards..."

# Add missing forwards
if [ -s "$DESIRED_LIST" ]; then
    comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read -r ext_port target_ip int_port; do
        if [ -n "$ext_port" ] && [ -n "$target_ip" ] && [ -n "$int_port" ]; then
            echo "Adding forward: external:$ext_port → $target_ip:$int_port"
            "$ADD_SCRIPT" "$ext_port" "$target_ip" "$int_port"
        fi
    done
fi

# Remove stale forwards
if [ -s "$ACTIVE_LIST" ]; then
    comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read -r ext_port target_ip int_port; do
        if [ -n "$ext_port" ] && [ -n "$target_ip" ] && [ -n "$int_port" ]; then
            echo "Removing forward: external:$ext_port → $target_ip:$int_port"
            "$REMOVE_SCRIPT" "$ext_port" "$target_ip" "$int_port"
        fi
    done
fi

echo "Sync complete:"
echo "Active forwards on our interfaces: $(wc -l < "$ACTIVE_LIST")"
echo "Desired forwards: $(wc -l < "$DESIRED_LIST")"
echo "Added: $(comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l || echo 0)"
echo "Removed: $(comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l || echo 0)"

