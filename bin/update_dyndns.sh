#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg


# Function to update DNS record
update_dns() {
    # Get the current IP from the primary interface (dynamically defined)
    IP=$(ip addr show "$PRIMARY_INTERFACE" | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)

    # Get current DNS record information
    CURRENT_IP=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result.content')

    # Update DNS record only if the IP has changed
    if [ "$IP" != "$CURRENT_IP" ]; then
        echo "Updating DNS record from $CURRENT_IP to $IP"
        curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$IP\",\"ttl\":120,\"proxied\":false}"
    else
        echo "IP address remains the same: $IP"
    fi
}

# Run the update function in a loop with a 1-minute sleep interval
#while true; do
#    update_dns
#    sleep 60
#done



