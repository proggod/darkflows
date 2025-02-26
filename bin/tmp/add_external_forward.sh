#!/bin/bash
set -e

source /etc/darkflows/d_network.cfg || {
    echo "Failed to source network config"
    exit 1
}

# Get gateways for both interfaces (unchanged logic)
PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
GATEWAY_PRIMARY=$(grep 'option routers' "$PRIMARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')
[ -n "$GATEWAY_PRIMARY" ] || { echo "Failed to get primary gateway IP"; exit 1; }

if [ -n "$SECONDARY_INTERFACE" ]; then
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"
    GATEWAY_SECONDARY=$(grep 'option routers' "$SECONDARY_LEASE_FILE" | tail -1 | awk '{print $3}' | tr -d ';')
    [ -n "$GATEWAY_SECONDARY" ] || { echo "Failed to get secondary gateway IP"; exit 1; }
fi

# Calculate network range from the INTERNAL_INTERFACE
IP_RANGE=$(ip -4 addr show dev "$INTERNAL_INTERFACE" | awk '/inet/ {print $2}')
[ -n "$IP_RANGE" ] || { echo "Failed to get network range (IP_RANGE)"; exit 1; }

# Also parse the LAN IP of this router on the internal interface.
# (Assumes there's exactly one IPv4 address on that interface.)
ROUTER_LAN_IP=$(ip -4 addr show dev "$INTERNAL_INTERFACE" | awk '/inet / { sub(/\/.*/, "", $2); print $2 }')
[ -n "$ROUTER_LAN_IP" ] || { echo "Failed to get router LAN IP"; exit 1; }

# Parse the WAN IP from the PRIMARY_INTERFACE (public or external IP).
# If you have a separate method of obtaining WAN_IP, change this line:
WAN_IP=$(ip -4 addr show dev "$PRIMARY_INTERFACE" | awk '/inet / { sub(/\/.*/, "", $2); print $2 }')
[ -n "$WAN_IP" ] || { echo "Failed to get WAN IP from $PRIMARY_INTERFACE"; exit 1; }

echo "Calculated IP_RANGE: $IP_RANGE"
echo "Router LAN IP:       $ROUTER_LAN_IP"
echo "WAN IP:             $WAN_IP"
echo "GATEWAY_PRIMARY:     $GATEWAY_PRIMARY"
echo "GATEWAY_SECONDARY:   $GATEWAY_SECONDARY"

#########################################################################
# Parse args
#########################################################################
if [ $# -ne 3 ]; then
    echo "Usage: $0 <external_port> <internal_ip> <internal_port>"
    exit 1
fi

EXT_PORT=$1
TARGET_IP=$2
INT_PORT=$3

# Basic validations
[[ "$EXT_PORT" =~ ^[0-9]+$ ]] && [ "$EXT_PORT" -ge 1 ] && [ "$EXT_PORT" -le 65535 ] || {
    echo "Invalid external port: $EXT_PORT"
    exit 1
}
[[ "$TARGET_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || {
    echo "Invalid IP: $TARGET_IP"
    exit 1
}
[[ "$INT_PORT" =~ ^[0-9]+$ ]] && [ "$INT_PORT" -ge 1 ] && [ "$INT_PORT" -le 65535 ] || {
    echo "Invalid internal port: $INT_PORT"
    exit 1
}

# Verify target IP is on the INTERNAL_INTERFACE
if ! ip route get "$TARGET_IP" 2>/dev/null | grep -q "$INTERNAL_INTERFACE"; then
    echo "Target IP $TARGET_IP is not routed via $INTERNAL_INTERFACE (expected in $IP_RANGE)"
    exit 1
fi

# Check if the DNAT rule already exists
nft list ruleset 2>/dev/null | \
    grep -q "tcp dport $EXT_PORT .* dnat to $TARGET_IP:$INT_PORT" && {
    echo "Forward already exists for external port $EXT_PORT → $TARGET_IP:$INT_PORT"
    exit 0
}

echo "Adding port forward external:$EXT_PORT → $TARGET_IP:$INT_PORT ..."

#########################################################################
# 1) DNAT for EXTERNAL inbound traffic
#    - Must arrive on WAN interface
#########################################################################
nft add rule ip nat prerouting \
    iif "$PRIMARY_INTERFACE" \
    tcp dport "$EXT_PORT" \
    dnat to "$TARGET_IP:$INT_PORT" 2>/dev/null

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule ip nat prerouting \
        iif "$SECONDARY_INTERFACE" \
        tcp dport "$EXT_PORT" \
        dnat to "$TARGET_IP:$INT_PORT" 2>/dev/null
fi

#########################################################################
# 2) SNAT for EXTERNAL traffic going to LAN (typical port-forward)
#    - As before, you use GATEWAY_PRIMARY or your public IP.
#    - Often you'd do: "snat to <router-wan-ip>" or "masquerade"
#########################################################################
nft add rule ip nat postrouting \
    ip saddr "$IP_RANGE" \
    ip daddr "$TARGET_IP" \
    tcp dport "$INT_PORT" \
    snat to "$GATEWAY_PRIMARY" 2>/dev/null

#########################################################################
# 3) Filter FORWARD rules: allow traffic
#########################################################################

# Internal -> Internal
nft add rule inet filter forward \
    iif "$INTERNAL_INTERFACE" \
    oif "$INTERNAL_INTERFACE" \
    ip daddr "$TARGET_IP" \
    tcp dport "$INT_PORT" \
    ct state new,established accept 2>/dev/null

nft add rule inet filter forward \
    iif "$INTERNAL_INTERFACE" \
    oif "$INTERNAL_INTERFACE" \
    ip saddr "$TARGET_IP" \
    tcp sport "$INT_PORT" \
    ct state established accept 2>/dev/null

# External -> Internal
nft add rule inet filter forward \
    iif "$PRIMARY_INTERFACE" \
    oif "$INTERNAL_INTERFACE" \
    ip daddr "$TARGET_IP" \
    tcp dport "$INT_PORT" \
    ct state new,established accept 2>/dev/null

nft add rule inet filter forward \
    iif "$INTERNAL_INTERFACE" \
    oif "$PRIMARY_INTERFACE" \
    ip saddr "$TARGET_IP" \
    tcp sport "$INT_PORT" \
    ct state established accept 2>/dev/null

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward \
        iif "$SECONDARY_INTERFACE" \
        oif "$INTERNAL_INTERFACE" \
        ip daddr "$TARGET_IP" \
        tcp dport "$INT_PORT" \
        ct state new,established accept 2>/dev/null

    nft add rule inet filter forward \
        iif "$INTERNAL_INTERFACE" \
        oif "$SECONDARY_INTERFACE" \
        ip saddr "$TARGET_IP" \
        tcp sport "$INT_PORT" \
        ct state established accept 2>/dev/null
fi

#########################################################################
# 4) Hairpin NAT (LAN clients → router's WAN IP → internal server)
#    - If you *do* want hairpin NAT, add these rules.
#    - We match iif "$INTERNAL_INTERFACE" + ip daddr "$WAN_IP" + EXT_PORT
#      then DNAT to $TARGET_IP:$INT_PORT.
#    - Then we SNAT back to the router's own LAN IP so the server replies
#      to the router, not directly to the client.
#########################################################################

# DNAT hairpin:
nft add rule ip nat prerouting \
    iif "$INTERNAL_INTERFACE" \
    ip daddr "$WAN_IP" \
    tcp dport "$EXT_PORT" \
    dnat to "$TARGET_IP:$INT_PORT" 2>/dev/null

# SNAT hairpin:
nft add rule ip nat postrouting \
    iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" \
    ip saddr "$IP_RANGE" \
    ip daddr "$TARGET_IP" \
    tcp dport "$INT_PORT" \
    snat to "$ROUTER_LAN_IP" 2>/dev/null

# Filter forward: The same internal->internal rules already handle traffic,
# so nothing more is strictly necessary, but it's fine to repeat if you have
# more granular rules.

echo "Added port forward external:$EXT_PORT → $TARGET_IP:$INT_PORT (hairpin included)"

