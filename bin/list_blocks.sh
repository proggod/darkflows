#!/bin/bash
# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

echo "BEGIN_ACTIVE_BLOCKS"
echo "BEGIN_MACS"
# Get and format MAC address blocks (only those with drop)
nft list chain inet filter forward | grep "ether saddr.*drop" | while read -r line; do
    mac=$(echo $line | grep -o -E "([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}")
    if [ ! -z "$mac" ]; then
        echo "$mac"
    fi
done
echo "END_MACS"

echo "BEGIN_IPS"
# Get and format IP address blocks (only those with drop)
nft list chain inet filter forward | grep "ip saddr.*drop" | while read -r line; do
    ip=$(echo $line | grep -o -E "([0-9]{1,3}\.){3}[0-9]{1,3}")
    if [ ! -z "$ip" ]; then
        echo "$ip"
    fi
done
echo "END_IPS"
echo "END_ACTIVE_BLOCKS"

echo "BEGIN_FILE_BLOCKS"
if [ -f "/etc/darkflows/blocked_clients.txt" ]; then
    # Read file content and ensure it ends with a newline
    while IFS= read -r line || [ -n "$line" ]; do
        echo "$line"
    done < "/etc/darkflows/blocked_clients.txt"
fi
echo "END_FILE_BLOCKS"

