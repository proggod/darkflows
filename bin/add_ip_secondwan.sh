#!/bin/bash
# add_ip_secondwan.sh
#
# Usage: ./add_ip_secondwan.sh 192.168.0.159
#
# Tells the kernel: "Traffic from IP X uses table 200."
# Must have already run setup_secondwan.sh to define table 200.

TABLE_ID="200"
PRIORITY="100"

if [ -z "$1" ]; then
  echo "Usage: $0 <IP-address>"
  exit 1
fi

IPADDR="$1"

echo "Routing $IPADDR via table $TABLE_ID..."
ip rule add from $IPADDR table $TABLE_ID priority $PRIORITY

echo "Current policy rules:"
ip rule show

