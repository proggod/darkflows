#!/bin/bash

KEA_DHCP4_FILE="/etc/kea/kea-dhcp4.conf"

# Check if an argument was provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a new interface name"
    echo "Usage: $0 <new_interface_name>"
    exit 1
fi

NEW_NAME="$1"

if [ -f "$KEA_DHCP4_FILE" ]; then
    # Use jq to update any interface name in the array to the provided name
    jq --arg new "$NEW_NAME" '
    .Dhcp4."interfaces-config".interfaces[0] = $new
    ' "$KEA_DHCP4_FILE" > "${KEA_DHCP4_FILE}.tmp" && 
    mv "${KEA_DHCP4_FILE}.tmp" "$KEA_DHCP4_FILE"
else
    echo "File $KEA_DHCP4_FILE not found!"
    exit 1
fi

