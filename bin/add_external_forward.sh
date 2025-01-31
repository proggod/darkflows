#!/bin/bash
set -e


source /etc/darkflows/d_network.cfg || { echo "Failed to source network config"; exit 1; }

# Get gateways for both interfaces
PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
GATEWAY_PRIMARY=$(grep 'option routers' "$PRIMARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')
[ -n "$GATEWAY_PRIMARY" ] || { echo "Failed to get primary gateway IP"; exit 1; }

if [ -n "$SECONDARY_INTERFACE" ]; then
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"
    GATEWAY_SECONDARY=$(grep 'option routers' "$SECONDARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')
    [ -n "$GATEWAY_SECONDARY" ] || { echo "Failed to get secondary gateway IP"; exit 1; }
fi

# Calculate network range from interface
IP_RANGE=$(ip -4 addr show dev $INTERNAL_INTERFACE | awk '/inet/ {print $2}')
[ -n "$IP_RANGE" ] || { echo "Failed to get network range"; exit 1; }

echo "Calculated IP_RANGE: $IP_RANGE, GATEWAY_PRIMARY: $GATEWAY_PRIMARY, GATEWAY_SECONDARY: $GATEWAY_SECONDARY"



if [ $# -ne 3 ]; then
    echo "Usage: $0 <external_port> <internal_ip> <internal_port>"
    exit 1
fi


EXT_PORT=$1
TARGET_IP=$2
INT_PORT=$3

[ "$EXT_PORT" -ge 1 ] && [ "$EXT_PORT" -le 65535 ] || { echo "Invalid external port"; exit 1; }
[[ "$TARGET_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "Invalid IP"; exit 1; }
[ "$INT_PORT" -ge 1 ] && [ "$INT_PORT" -le 65535 ] || { echo "Invalid internal port"; exit 1; }

# Validate target IP is in network range
if ! ip route get "$TARGET_IP" | grep -q "$INTERNAL_INTERFACE"; then
    echo "Target IP not in internal network range ($IP_RANGE)"
    exit 1
fi

nft list ruleset 2>/dev/null | grep -q "tcp dport $EXT_PORT.*dnat to $TARGET_IP:$INT_PORT" && {
    echo "Forward already exists"
    exit 0
}

# DNAT Rule
nft add rule ip nat prerouting \
    tcp dport $EXT_PORT \
    ip saddr != $TARGET_IP \
    dnat to $TARGET_IP:$INT_PORT 2>/dev/null

# SNAT Rule
nft add rule ip nat postrouting \
    ip saddr $IP_RANGE \
    ip daddr $TARGET_IP \
    tcp dport $INT_PORT \
    snat to $GATEWAY_PRIMARY 2>/dev/null

# Internal to Internal forwarding
nft add rule inet filter forward \
    iif $INTERNAL_INTERFACE \
    oif $INTERNAL_INTERFACE \
    ip daddr $TARGET_IP \
    tcp dport $INT_PORT \
    ct state new,established accept 2>/dev/null

nft add rule inet filter forward \
    iif $INTERNAL_INTERFACE \
    oif $INTERNAL_INTERFACE \
    ip saddr $TARGET_IP \
    tcp sport $INT_PORT \
    ct state established accept 2>/dev/null

# External to Internal forwarding
for WAN_IF in $PRIMARY_INTERFACE ${SECONDARY_INTERFACE:+"$SECONDARY_INTERFACE"}; do
    nft add rule inet filter forward \
        iif $WAN_IF \
        oif $INTERNAL_INTERFACE \
        ip daddr $TARGET_IP \
        tcp dport $INT_PORT \
        ct state new,established accept 2>/dev/null

    nft add rule inet filter forward \
        iif $INTERNAL_INTERFACE \
        oif $WAN_IF \
        ip saddr $TARGET_IP \
        tcp sport $INT_PORT \
        ct state established accept 2>/dev/null
done

echo "Added port forward external:$EXT_PORT → $TARGET_IP:$INT_PORT"




