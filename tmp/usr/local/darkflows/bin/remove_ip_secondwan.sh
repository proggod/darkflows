#!/bin/bash
# remove_ip_secondwan.sh
#
# Usage: ./remove_ip_secondwan.sh 192.168.0.159
#
# Removes the policy rule that routes traffic from IP X to table 200.

TABLE_ID="200"
PRIORITY="100"

if [ -z "$1" ]; then
  echo "Usage: $0 <IP-address>"
  exit 1
fi

IPADDR="$1"

echo "Removing secondary route rule for $IPADDR..."
ip rule del from $IPADDR table $TABLE_ID priority $PRIORITY

echo "Current policy rules:"
ip rule show

