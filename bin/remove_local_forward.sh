#!/bin/bash
set -e

# Suppress nftables warnings
export NFT_NO_WARN=1

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <external_port> [local_port]"
    exit 1
fi

EXT_PORT=$1
LOCAL_PORT=${2:-$1}  # Default to external port if local port not specified

echo "Removing local port forwarding $EXT_PORT -> $LOCAL_PORT"
echo "----------------------------------------------------"

###############################################################################
# 1) Delete the DNAT rule from table ip nat, chain prerouting
###############################################################################
echo "Searching for NAT DNAT rule in table ip nat, chain prerouting..."
# This should match a rule like:
#   iif != "lo" tcp dport 5080 dnat to 127.0.0.1:5080 # handle <number>
NAT_RULE=$(nft -a list chain ip nat prerouting | grep "tcp dport $EXT_PORT dnat to 127.0.0.1:$LOCAL_PORT")
if [ -n "$NAT_RULE" ]; then
    echo "Found NAT rule:"
    echo "$NAT_RULE"
    NAT_HANDLE=$(echo "$NAT_RULE" | grep -o 'handle [0-9]\+' | awk '{print $2}')
    echo "Deleting NAT rule with handle $NAT_HANDLE..."
    sudo nft delete rule ip nat prerouting handle $NAT_HANDLE && \
        echo "NAT rule deleted." || \
        echo "Failed to delete NAT rule."
else
    echo "No matching NAT rule found in table ip nat prerouting."
fi

###############################################################################
# 2) Delete the ACCEPT rule from table inet filter, chain input
###############################################################################
echo
echo "Searching for FILTER ACCEPT rule in table inet filter, chain input..."
# This should match a rule like:
#   iifname != "lo" tcp dport 5080 ct state established,new accept # handle <number>
FILTER_RULE=$(nft -a list chain inet filter input | grep "tcp dport $EXT_PORT" | grep "accept")
if [ -n "$FILTER_RULE" ]; then
    echo "Found FILTER rule:"
    echo "$FILTER_RULE"
    FILTER_HANDLE=$(echo "$FILTER_RULE" | grep -o 'handle [0-9]\+' | awk '{print $2}')
    echo "Deleting FILTER rule with handle $FILTER_HANDLE..."
    sudo nft delete rule inet filter input handle $FILTER_HANDLE && \
        echo "FILTER rule deleted." || \
        echo "Failed to delete FILTER rule."
else
    echo "No matching FILTER rule found in table inet filter input."
fi

echo
echo "Finished processing local port forwarding removal for port $EXT_PORT."



