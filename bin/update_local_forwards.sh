#!/bin/bash
set -e

CONFIG_DIR="/etc/darkflows"
TARGET_FILE="${CONFIG_DIR}/local_forwards.txt"
ADD_SCRIPT="/usr/local/darkflows/bin/add_local_forward.sh"
REMOVE_SCRIPT="/usr/local/darkflows/bin/remove_local_forward.sh"

[[ -f "$TARGET_FILE" ]] || { echo "Missing target file: $TARGET_FILE"; exit 1; }
[[ -x "$ADD_SCRIPT" ]] || { echo "Missing add script: $ADD_SCRIPT"; exit 1; }
[[ -x "$REMOVE_SCRIPT" ]] || { echo "Missing remove script: $REMOVE_SCRIPT"; exit 1; }

ACTIVE_LIST=$(mktemp)
DESIRED_LIST=$(mktemp)
trap 'rm -f "$ACTIVE_LIST" "$DESIRED_LIST"' EXIT

echo "Listing active local forwards..."
# Look for lines with either "redirect to" or "dnat to 127.0.0.1:"
nft -a list ruleset 2>/dev/null | grep -E 'tcp dport [0-9]+ (redirect to|dnat to 127\.0\.0\.1:)' | \
awk '{
    ext=""; local="";
    for(i=1;i<=NF;i++){
       if($i=="dport") { ext=$(i+1); }
       if($i=="dnat"){
           i++;  # skip "to"
           i++;
           split($i, a, ":");
           local = a[2];
       }
       if($i=="redirect"){
           i++;  # skip "to"
           i++;
           split($i, a, ":");
           local = a[2];
       }
    }
    if(ext != "" && local != "") { print ext ":" local; }
}' | sort > "$ACTIVE_LIST"

echo "Reading desired configuration..."
grep -vE '^#|^$' "$TARGET_FILE" | \
awk 'BEGIN {FS=":"} 
    $1 ~ /^[0-9]+$/ && ($2 == "" || $2 ~ /^[0-9]+$/) { print $1 ":" ($2 ? $2 : $1) }' | \
sort > "$DESIRED_LIST"

echo "Synchronizing forwards..."

# Add missing forwards: those in the desired config but not active
comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read -r ext_port local_port; do
    echo "Adding forward: $ext_port -> $local_port"
    "$ADD_SCRIPT" "$ext_port" "$local_port"
done

# Remove stale forwards: those active but not in desired config
comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | while IFS=: read -r ext_port local_port; do
    echo "Removing forward: $ext_port -> $local_port"
    "$REMOVE_SCRIPT" "$ext_port" "$local_port"
done

echo "Sync complete:"
echo "Active forwards: $(wc -l < "$ACTIVE_LIST")"
echo "Desired forwards: $(wc -l < "$DESIRED_LIST")"
echo "Added: $(comm -23 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l)"
echo "Removed: $(comm -13 "$DESIRED_LIST" "$ACTIVE_LIST" | wc -l)"



