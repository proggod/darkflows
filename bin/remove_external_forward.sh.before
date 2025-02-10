#!/bin/bash
set -e

if [ $# -ne 3 ]; then
    echo "Usage: $0 <external_port> <internal_ip> <internal_port>"
    exit 1
fi

EXT_PORT=$1
TARGET_IP=$2
INT_PORT=$3

echo "Removing forward from external:$EXT_PORT to $TARGET_IP:$INT_PORT"

# Delete NAT rules
nft -a list ruleset 2>/dev/null | awk -v eport=$EXT_PORT -v tip=$TARGET_IP -v iport=$INT_PORT '
/(dnat|snat) to/ {
    match($0, /handle [0-9]+/)
    if (RLENGTH > 0) {
        if ($0 ~ /dnat/ && $3 == eport && index($0, tip":"iport))
            print "delete rule ip nat prerouting " substr($0, RSTART, RLENGTH)
        else if ($0 ~ /snat/ && index($0, tip) && index($0, iport))
            print "delete rule ip nat postrouting " substr($0, RSTART, RLENGTH)
    }
}' | while read -r cmd; do
    nft $cmd
done

# Delete forward rules
nft -a list chain inet filter forward 2>/dev/null | awk -v tip=$TARGET_IP -v iport=$INT_PORT '
/tcp (dport|sport).*ct state/ {
    match($0, /handle [0-9]+/)
    if (RLENGTH > 0 && ((index($0, "dport") && index($0, tip) && index($0, iport)) || \
                        (index($0, "sport") && index($0, tip) && index($0, iport)))) {
        print "delete rule inet filter forward " substr($0, RSTART, RLENGTH)
    }
}' | while read -r cmd; do
    nft $cmd
done

echo "Removed port forward external:$EXT_PORT → $TARGET_IP:$INT_PORT"
