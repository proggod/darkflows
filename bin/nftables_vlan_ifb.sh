#!/bin/bash
#
# nftables_vlan_ifb.sh - Configure a dedicated IFB and CAKE shaping for a VLAN
#
# Usage: ./nftables_vlan_ifb.sh <vlan-id>
#    e.g. ./nftables_vlan_ifb.sh 2.12
#

# --- 1) Check Input ---
if [ $# -lt 1 ]; then
    echo "Usage: $0 <vlan-id>"
    exit 1
fi

VLAN_ID="$1"

# For VLAN "2.12", this grabs the last segment "12".
# For VLAN "12", it just returns "12".
# Adjust this if you prefer a different naming scheme.
IFB_SUFFIX=$(echo "$VLAN_ID" | awk -F '.' '{print $NF}')
IFB_DEV="ifb${IFB_SUFFIX}"

# --- 2) Load Config ---
CONFIG_FILE="/etc/darkflows/d_network.cfg"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Configuration file $CONFIG_FILE not found!"
    exit 1
fi

source "$CONFIG_FILE" || {
    echo "Failed to source $CONFIG_FILE"
    exit 1
}

# Construct VLAN-specific variable names
VLAN_VAR_ID=$(echo "$VLAN_ID" | sed 's/\./_/g')  # "2_12" from "2.12"
VLAN_INTERFACE_VAR="VLAN_${VLAN_VAR_ID}_INTERFACE"
VLAN_EGRESS_BW_VAR="VLAN_${VLAN_VAR_ID}_EGRESS_BANDWIDTH"
VLAN_INGRESS_BW_VAR="VLAN_${VLAN_VAR_ID}_INGRESS_BANDWIDTH"
VLAN_CAKE_PARAMS_VAR="VLAN_${VLAN_VAR_ID}_CAKE_PARAMS"

# Pull actual values from config
VLAN_INTERFACE="${!VLAN_INTERFACE_VAR}"
VLAN_EGRESS_BW="${!VLAN_EGRESS_BW_VAR}"
VLAN_INGRESS_BW="${!VLAN_INGRESS_BW_VAR}"
VLAN_CAKE_PARAMS="${!VLAN_CAKE_PARAMS_VAR}"

if [ -z "$VLAN_INTERFACE" ]; then
    echo "No VLAN interface configured for VLAN ID '$VLAN_ID' in $CONFIG_FILE."
    exit 1
fi

# --- 3) Info ---
echo "========================================="
echo "Configuring VLAN: $VLAN_INTERFACE"
echo "Using dedicated IFB: $IFB_DEV"
echo "Egress BW: $VLAN_EGRESS_BW"
echo "Ingress BW: $VLAN_INGRESS_BW"
echo "CAKE Params: $VLAN_CAKE_PARAMS"
echo "Primary WAN Interface: $PRIMARY_INTERFACE"
[ -n "$SECONDARY_INTERFACE" ] && echo "Secondary WAN Interface: $SECONDARY_INTERFACE"
echo "Internal LAN Interface: $INTERNAL_INTERFACE"
echo "========================================="

# --- 4) Enable IP Forwarding (if not already) ---
sysctl -w net.ipv4.ip_forward=1
# Optionally disable IPv6
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# --- 5) Setup the dedicated IFB for this VLAN ---
modprobe ifb || true
# If $IFB_DEV already exists, remove it first
ip link del "$IFB_DEV" 2>/dev/null || true
ip link add "$IFB_DEV" type ifb
ip link set "$IFB_DEV" up

# --- 6) Clear any qdisc on VLAN interface & IFB ---
tc qdisc del dev "$VLAN_INTERFACE" root 2>/dev/null || true
tc qdisc del dev "$VLAN_INTERFACE" ingress 2>/dev/null || true
tc qdisc del dev "$IFB_DEV" root 2>/dev/null || true

# --- 7) Ingress Redirection (VLAN -> IFB) ---
tc qdisc add dev "$VLAN_INTERFACE" handle ffff: ingress
tc filter add dev "$VLAN_INTERFACE" parent ffff: protocol all u32 match u32 0 0 \
    action mirred egress redirect dev "$IFB_DEV"

# --- 8) Egress Shaping for VLAN ---
tc qdisc add dev "$VLAN_INTERFACE" root cake \
    bandwidth "$VLAN_EGRESS_BW" \
    $VLAN_CAKE_PARAMS

# --- 9) Ingress Shaping on $IFB_DEV ---
tc qdisc add dev "$IFB_DEV" root cake \
    bandwidth "$VLAN_INGRESS_BW" \
    $VLAN_CAKE_PARAMS

# --- 10) NAT + Forwarding for VLAN Traffic ---
# We won't flush global tables so as not to break main script, but let's ensure these rules exist.

# NAT: Add a postrouting chain if needed
nft add table ip nat 2>/dev/null || true
nft add chain ip nat postrouting '{ type nat hook postrouting priority 100 ; }' 2>/dev/null || true

# Masquerade VLAN traffic out of PRIMARY_INTERFACE (if not already)
nft list ruleset | grep -q "iif \"$VLAN_INTERFACE\" oif \"$PRIMARY_INTERFACE\" masquerade" \
  || nft add rule ip nat postrouting iif "$VLAN_INTERFACE" oif "$PRIMARY_INTERFACE" masquerade

# Filter: Forward chain
nft add table inet filter 2>/dev/null || true
nft add chain inet filter forward '{ type filter hook forward priority 0 ; policy drop ; }' 2>/dev/null || true

# Allow VLAN -> WAN
nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$PRIMARY_INTERFACE\" accept" \
  || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$PRIMARY_INTERFACE" accept

# Allow WAN -> VLAN (established/related)
nft list chain inet filter forward | grep -q "iif \"$PRIMARY_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
  || nft add rule inet filter forward iif "$PRIMARY_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept

# (Optional) For VLAN <-> INTERNAL
if [ -n "$INTERNAL_INTERFACE" ]; then
    # VLAN -> INTERNAL
    nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$INTERNAL_INTERFACE\" accept" \
      || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$INTERNAL_INTERFACE" accept

    # INTERNAL -> VLAN (established)
    nft list chain inet filter forward | grep -q "iif \"$INTERNAL_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
      || nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept
fi

# (Optional) If you want VLAN traffic to also go out via SECONDARY_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    # NAT
    nft list ruleset | grep -q "iif \"$VLAN_INTERFACE\" oif \"$SECONDARY_INTERFACE\" masquerade" \
      || nft add rule ip nat postrouting iif "$VLAN_INTERFACE" oif "$SECONDARY_INTERFACE" masquerade

    nft list chain inet filter forward | grep -q "iif \"$VLAN_INTERFACE\" oif \"$SECONDARY_INTERFACE\" accept" \
      || nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$SECONDARY_INTERFACE" accept

    nft list chain inet filter forward | grep -q "iif \"$SECONDARY_INTERFACE\" oif \"$VLAN_INTERFACE\" ct state established,related accept" \
      || nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$VLAN_INTERFACE" ct state established,related accept
fi

# --- 11) Verification ---
echo "========================================="
echo "TC stats for $VLAN_INTERFACE:"
tc -s qdisc show dev "$VLAN_INTERFACE"
echo "TC stats for $IFB_DEV:"
tc -s qdisc show dev "$IFB_DEV"

echo "Current nftables forward chain (partial):"
nft list chain inet filter forward
echo "Current nftables nat postrouting (partial):"
nft list chain ip nat postrouting

echo "VLAN '$VLAN_ID' configured with dedicated IFB '$IFB_DEV' successfully."
exit 0

