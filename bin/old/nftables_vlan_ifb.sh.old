#!/bin/bash
#
# nftables_vlan_ifb.sh - Configure a dedicated IFB and CAKE shaping for a VLAN
#                        using data from /etc/darkflows/vlans.json
#
# Usage: ./nftables_vlan_ifb.sh <vlan-id>
#    e.g. ./nftables_vlan_ifb.sh 12
#
# Requirements:
#   - /etc/darkflows/d_network.cfg (for PRIMARY_INTERFACE, etc.)
#   - /etc/darkflows/vlans.json    (for VLAN-specific egress/ingress/cakeParams)
#   - jq installed

set -e

# --- 1) Check Input ---
if [ $# -lt 1 ]; then
    echo "Usage: $0 <vlan-id>"
    echo "Example: $0 12"
    exit 1
fi

VLAN_ID="$1"  # e.g. "12"

CONFIG_FILE="/etc/darkflows/d_network.cfg"
VLANS_JSON="/etc/darkflows/vlans.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Configuration file $CONFIG_FILE not found!"
    exit 1
fi

if [ ! -f "$VLANS_JSON" ]; then
    echo "VLAN JSON file $VLANS_JSON not found!"
    exit 1
fi

# --- 2) Load Base Config for Primary/Secondary/Internal
source "$CONFIG_FILE" || {
    echo "Failed to source $CONFIG_FILE"
    exit 1
}

# --- 3) Check for jq
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: 'jq' is not installed (apt-get install jq)."
  exit 1
fi

# --- 4) Parse VLAN Data from JSON
# We'll find the object where .id == VLAN_ID
# If none is found, .id == null => we exit.
VLAN_DATA=$(jq -r --arg VID "$VLAN_ID" \
  '.[] | select(.id == ($VID|tonumber))' "$VLANS_JSON")

if [ -z "$VLAN_DATA" ]; then
    echo "No VLAN with id=$VLAN_ID found in $VLANS_JSON"
    exit 1
fi

# Extract relevant fields
VLAN_LABEL=$(echo "$VLAN_DATA" | jq -r '.networkCard.label // ""' | tr '[:upper:]' '[:lower:]')
VLAN_DEVICE_NAME=$(echo "$VLAN_DATA" | jq -r '.networkCard.deviceName // ""')
VLAN_EGRESS_BW=$(echo "$VLAN_DATA" | jq -r '.egressBandwidth // "50mbit"')
VLAN_INGRESS_BW=$(echo "$VLAN_DATA" | jq -r '.ingressBandwidth // "200mbit"')
VLAN_CAKE_PARAMS=$(echo "$VLAN_DATA" | jq -r '.cakeParams // "ethernet besteffort wash internet split-gso rtt 50ms nat memlimit 8mb"')

# Map the label to the actual base interface from d_network.cfg
# If label is "internal" => use $INTERNAL_INTERFACE
# If label is "primary"  => use $PRIMARY_INTERFACE
# etc. If label is empty or unknown, fallback to deviceName
declare -A LABEL_MAP=(
  [internal]="$INTERNAL_INTERFACE"
  [primary]="$PRIMARY_INTERFACE"
  [secondary]="$SECONDARY_INTERFACE"
)

BASE_IF="${LABEL_MAP[$VLAN_LABEL]}"
if [ -z "$BASE_IF" ] || [ "$BASE_IF" = "null" ]; then
    # fallback to deviceName if label not recognized
    BASE_IF="$VLAN_DEVICE_NAME"
fi

if [ -z "$BASE_IF" ]; then
    echo "ERROR: Could not determine base interface (no label or deviceName)."
    exit 1
fi

# Final VLAN interface name, e.g. lan0.12
VLAN_INTERFACE="${BASE_IF}.${VLAN_ID}"

# Create a dedicated IFB name, e.g. ifb12
IFB_DEV="ifb${VLAN_ID}"

# --- 5) Show Info ---
echo "========================================="
echo "VLAN ID: $VLAN_ID"
echo "Base Interface: $BASE_IF  (label='$VLAN_LABEL')"
echo "VLAN Interface: $VLAN_INTERFACE"
echo "Dedicated IFB:  $IFB_DEV"
echo "Egress BW:      $VLAN_EGRESS_BW"
echo "Ingress BW:     $VLAN_INGRESS_BW"
echo "CAKE Params:    $VLAN_CAKE_PARAMS"
echo "Primary WAN:    $PRIMARY_INTERFACE"
[ -n "$SECONDARY_INTERFACE" ] && echo "Secondary WAN:  $SECONDARY_INTERFACE"
echo "Internal LAN:   $INTERNAL_INTERFACE"
echo "========================================="

# --- 6) Enable IPv4 Forwarding ---
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# --- 7) Setup ifb for This VLAN ---
modprobe ifb || true

# If the IFB device already exists, remove it first
ip link del "$IFB_DEV" 2>/dev/null || true
ip link add "$IFB_DEV" type ifb
ip link set "$IFB_DEV" up

# --- 8) Clear any qdisc on VLAN interface & IFB
tc qdisc del dev "$VLAN_INTERFACE" root 2>/dev/null || true
tc qdisc del dev "$VLAN_INTERFACE" ingress 2>/dev/null || true
tc qdisc del dev "$IFB_DEV" root 2>/dev/null || true

# --- 9) Ingress Redirection (VLAN -> IFB)
tc qdisc add dev "$VLAN_INTERFACE" handle ffff: ingress
tc filter add dev "$VLAN_INTERFACE" parent ffff: protocol all u32 match u32 0 0 \
    action mirred egress redirect dev "$IFB_DEV"

# --- 10) Egress Shaping for VLAN
tc qdisc add dev "$VLAN_INTERFACE" root cake \
    bandwidth "$VLAN_EGRESS_BW" \
    $VLAN_CAKE_PARAMS

# --- 11) Ingress Shaping on $IFB_DEV
tc qdisc add dev "$IFB_DEV" root cake \
    bandwidth "$VLAN_INGRESS_BW" \
    $VLAN_CAKE_PARAMS

# --- 12) NAT + Forwarding for VLAN Traffic ---

# NAT: Add a postrouting chain if needed
nft add table ip nat 2>/dev/null || true
nft add chain ip nat postrouting '{ type nat hook postrouting priority 100 ; }' 2>/dev/null || true

# Masquerade VLAN traffic out of PRIMARY_INTERFACE (if not already)
if [ -n "$PRIMARY_INTERFACE" ]; then
  nft list ruleset | grep -q "iif \"$VLAN_INTERFACE\" oif \"$PRIMARY_INTERFACE\" masquerade" \
    || nft add rule ip nat postrouting iif "$VLAN_INTERFACE" oif "$PRIMARY_INTERFACE" masquerade
fi

# Filter: Forward chain
nft add table inet filter 2>/dev/null || true
nft add chain inet filter forward '{ type filter hook forward priority 0 ; policy drop ; }' 2>/dev/null || true

# Allow VLAN -> WAN
if [ -n "$PRIMARY_INTERFACE" ]; then
  nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$PRIMARY_INTERFACE\" accept" \
    || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$PRIMARY_INTERFACE" accept

  # Allow WAN -> VLAN (established/related)
  nft list chain inet filter forward | grep -q "iif \"$PRIMARY_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
    || nft add rule inet filter forward iif "$PRIMARY_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept
fi

# (Optional) VLAN <-> INTERNAL
if [ -n "$INTERNAL_INTERFACE" ]; then
  # VLAN -> INTERNAL
  nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$INTERNAL_INTERFACE\" accept" \
    || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$INTERNAL_INTERFACE" accept

  # INTERNAL -> VLAN (established)
  nft list chain inet filter forward | grep -q "iif \"$INTERNAL_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
    || nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept
fi

# (Optional) If you want VLAN -> SECONDARY_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
  nft list ruleset | grep -q "iif \"$VLAN_INTERFACE\" oif \"$SECONDARY_INTERFACE\" masquerade" \
    || nft add rule ip nat postrouting iif "$VLAN_INTERFACE" oif "$SECONDARY_INTERFACE" masquerade

  nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$SECONDARY_INTERFACE\" accept" \
    || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$SECONDARY_INTERFACE" accept

  nft list chain inet filter forward | grep -q "iif \"$SECONDARY_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
    || nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept
fi

# --- 13) Verification ---
echo "========================================="
echo "TC stats for $VLAN_INTERFACE:"
tc -s qdisc show dev "$VLAN_INTERFACE"
echo "TC stats for $IFB_DEV:"
tc -s qdisc show dev "$IFB_DEV"

echo "Current nftables forward chain (partial):"
nft list chain inet filter forward || true
echo "Current nftables nat postrouting (partial):"
nft list chain ip nat postrouting || true

echo "VLAN '$VLAN_ID' configured with dedicated IFB '$IFB_DEV' successfully."
exit 0


