#!/bin/bash
# Load configuration
source /etc/darkflows/d_network.cfg

# Function to get public IP from external services
get_public_ip() {
    # Array of IP services
    IP_SERVICES=(
        "https://api.ipify.org"
        "https://icanhazip.com"
        "https://ifconfig.me"
        "https://checkip.amazonaws.com"
        "https://ipinfo.io/ip"
    )
    
    # Shuffle the array to randomize the order
    SHUFFLED_SERVICES=($(shuf -e "${IP_SERVICES[@]}"))
    
    # Try each service until successful
    for service in "${SHUFFLED_SERVICES[@]}"; do
        echo "Trying to get public IP from: $service"
        IP=$(curl -s --connect-timeout 5 "$service")
        
        # Validate IP format (basic check)
        if [[ $IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Successfully retrieved public IP: $IP from $service"
            return 0
        else
            echo "Failed to get valid IP from $service, trying next service..."
        fi
    done
    
    # If all services fail, return error
    echo "Failed to retrieve public IP from any service"
    return 1
}

# Function to update DNS record
update_dns() {
    # Check if required variables are not empty
    if [ -z "$ZONE_ID" ] || [ -z "$RECORD_ID" ] || [ -z "$API_TOKEN" ] || [ -z "$RECORD_NAME" ]; then
        echo "One or more required variables are empty. Exiting without making changes."
        return 1
    fi

    # Get the public IP using our new function instead of local interface
    if ! get_public_ip; then
        echo "Could not retrieve public IP. Exiting."
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
        UPDATE_RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$IP\",\"ttl\":120,\"proxied\":false}")
            
        # Check if update was successful
        SUCCESS=$(echo "$UPDATE_RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            echo "DNS record successfully updated to $IP"
        else
            ERROR=$(echo "$UPDATE_RESPONSE" | jq -r '.errors[0].message')
            echo "Failed to update DNS record: $ERROR"
        fi
    else
        echo "IP address remains the same: $IP. No update needed."
    fi
}

# Main execution
echo "Starting DNS update process at $(date)"

# Check for jq dependency
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to run this script."
    exit 1
fi

# Only call the function if we have the required variables
if [ -n "$ZONE_ID" ] && [ -n "$RECORD_ID" ] && [ -n "$API_TOKEN" ] && [ -n "$RECORD_NAME" ]; then
    update_dns
else
    echo "Script initialized but not running due to one or more empty configuration variables."
    echo "Please check your configuration in /etc/darkflows/d_network.cfg"
fi

echo "DNS update process completed at $(date)"

