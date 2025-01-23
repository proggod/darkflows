#!/bin/bash
set -e

CONFIG_DIR="/etc/darkflows"
TARGET_FILE="${CONFIG_DIR}/external_forwards.txt"
ADD_SCRIPT="/usr/local/darkflows/bin/add_external_forward.sh"
REMOVE_SCRIPT="/usr/local/darkflows/bin/remove_external_forward.sh"

# Validate environment
[[ -f "$TARGET_FILE" ]] || { echo "Missing target file: $TARGET_FILE"; exit 1; }
[[ -x "$ADD_SCRIPT" ]] || { echo "Missing add script: $ADD_SCRIPT"; exit 1; }
[[ -x "$REMOVE_SCRIPT" ]] || { echo "Missing remove script: $REMOVE_SCRIPT"; exit 1; }

# Temporary files
ACTIVE_LIST=$(mktemp)
DESIRED_LIST=$(mktemp)
trap 'rm -f "$ACTIVE_LIST" "$DESIRED_LIST"' EXIT

# Get active forwards (ext_port:target_ip:int_port)
echo "Listing active forwards..."
nft list ruleset | \
    grep -oE 'tcp dport ([0-9]+).*dnat to ([0-9.]+):([0-9]+)' | \
    sed -E 's/tcp dport ([0-9]+).*dnat to ([0-9.]+):([0-9]+)/\1:\2:\3/' | \
    sort > "$ACTIVE_LIST"

# Parse desired forwards
echo "Reading desired configuration..."
grep -vE '^#|^$' "$TARGET_FILE" | \
    awk 'BEGIN {FS=":"} 
    $1 ~ /^[0-9]+$/ && 
    $2 ~ /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/ && 
    $3 ~ /^[0-9]+$/ {print $1":"$2":"$3}' | \
    sort > "$DESIRED_LIST"

# Process changes
echo "Synchronizing forwards..."

# Add missing forwards
comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read ext_port target_ip int_port; do
    echo "Adding forward: external:$ext_port → $target_ip:$int_port"
    "$ADD_SCRIPT" "$ext_port" "$target_ip" "$int_port"
done

# Remove stale forwards
comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read ext_port target_ip int_port; do
    echo "Removing forward: external:$ext_port → $target_ip:$int_port"
    "$REMOVE_SCRIPT" "$ext_port" "$target_ip" "$int_port"
done

echo "Sync complete:"
echo "Active forwards: $(wc -l < "$ACTIVE_LIST")"
echo "Desired forwards: $(wc -l < "$DESIRED_LIST")"
echo "Added: $(comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l)"
echo "Removed: $(comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l)"

