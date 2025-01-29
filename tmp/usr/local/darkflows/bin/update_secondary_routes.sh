#!/bin/bash

IP_LIST_FILE="/etc/darkflows/route_to_secondary.txt"
TABLE_ID="200"
PRIORITY="100"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

if [[ ! -f "$IP_LIST_FILE" ]]; then
    log "Error: IP list file $IP_LIST_FILE not found."
    exit 1
fi

IP_LIST=$(cat "$IP_LIST_FILE")

# CORRECTED: Use $3 instead of $2 to extract the IP
CURRENT_ROUTED_IPS=$(ip rule show | awk -v table="$TABLE_ID" '/from/ && $NF == table {print $3}')

# Remove rules for IPs not in the list
for IP in $CURRENT_ROUTED_IPS; do
    if ! grep -Fxq "$IP" "$IP_LIST_FILE"; then
        log "Removing routing rule for $IP..."
        ip rule del from "$IP" table "$TABLE_ID" priority "$PRIORITY"
    fi
done

# Add rules for new IPs
for IP in $IP_LIST; do
    if ! echo "$CURRENT_ROUTED_IPS" | grep -Fxq "$IP"; then
        log "Adding routing rule for $IP..."
        ip rule add from "$IP" table "$TABLE_ID" priority "$PRIORITY"
    fi
done

log "Routing rules synchronized."

