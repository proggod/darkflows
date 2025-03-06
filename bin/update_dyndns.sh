#!/bin/bash

# Source the network configuration file
source /etc/darkflows/d_network.cfg

# Function to update DNS record
update_dns() {
    # Check if required variables are not empty
    if [ -z "$PRIMARY_INTERFACE" ] || [ -z "$ZONE_ID" ] || [ -z "$RECORD_ID" ] || [ -z "$API_TOKEN" ] || [ -z "$RECORD_NAME" ]; then
        echo "One or more required variables are empty. Exiting without making changes."
        return 1
    fi

    # Get the current IP from the primary interface (dynamically defined)
    IP=$(ip addr show "$PRIMARY_INTERFACE" | grep "inet\b" | awk '{print $2}' | cut -d/ -f1)
    
    # Check if IP was retrieved successfully
    if [ -z "$IP" ]; then
        echo "Failed to retrieve IP address from interface $PRIMARY_INTERFACE. Exiting."
        return 1
    fi

    # Get current DNS record information
    echo "Retrieving DNS information for Zone ID: $ZONE_ID, Record ID: $RECORD_ID"
    CF_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    echo "Cloudflare API response: $CF_RESPONSE"
    
    CURRENT_IP=$(echo "$CF_RESPONSE" | jq -r '.result.content')
    
    # Check if current IP was retrieved successfully
    if [ -z "$CURRENT_IP" ] || [ "$CURRENT_IP" == "null" ]; then
        echo "Failed to retrieve current DNS record information. Exiting."
        echo "Check your ZONE_ID, RECORD_ID, and API_TOKEN in /etc/darkflows/d_network.cfg"
        return 1
    fi

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

# Only call the function if we have the required variables
if [ -n "$PRIMARY_INTERFACE" ] && [ -n "$ZONE_ID" ] && [ -n "$RECORD_ID" ] && [ -n "$API_TOKEN" ] && [ -n "$RECORD_NAME" ]; then
    update_dns
else
    echo "Script initialized but not running due to one or more empty configuration variables."
fi

