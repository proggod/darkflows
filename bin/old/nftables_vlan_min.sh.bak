#!/usr/bin/env bash
#
# nftables_vlan_ifb.sh - Configure nftables rules for a VLAN interface
# Usage: nftables_vlan_ifb.sh <VLAN_ID>
#

set -e

# Check if VLAN ID was provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 <VLAN_ID>"
  exit 1
fi

VLAN_ID="$1"
VLAN_JSON="/etc/darkflows/vlans.json"
PRIMARY_INTERFACE="lan0"  # The parent interface for VLANs
VLAN_INTERFACE="${PRIMARY_INTERFACE}.${VLAN_ID}"
WAN_INTERFACES=("lan1" "lan2")  # Primary and secondary WAN interfaces

# Load the VLAN configuration
if ! command -v jq &>/dev/null; then
  echo "ERROR: 'jq' is not installed. Please install (e.g., apt-get install jq)."
  exit 1
fi

# Check if the VLAN interface exists
if ! ip link show dev "$VLAN_INTERFACE" &>/dev/null; then
  echo "ERROR: VLAN interface $VLAN_INTERFACE does not exist"
  exit 1
fi

echo "Configuring firewall rules for VLAN interface $VLAN_INTERFACE"

# Add nftables rules for the VLAN
# 1. Accept all traffic from the VLAN interface (input rule)
nft insert rule inet filter input position 0 iif "$VLAN_INTERFACE" accept

# 2. Allow traffic from VLAN to WANs (forward rules)
for WAN in "${WAN_INTERFACES[@]}"; do
  if ip link show dev "$WAN" &>/dev/null; then
    # Forward from VLAN to WAN
    nft add rule inet filter forward iif "$VLAN_INTERFACE" oif "$WAN" accept
    
    # Allow return traffic from WAN to VLAN
    nft add rule inet filter forward iif "$WAN" oif "$VLAN_INTERFACE" ct state established,related accept
  fi
done

# 3. Setup NAT for the VLAN (if not already configured)
for WAN in "${WAN_INTERFACES[@]}"; do
  if ip link show dev "$WAN" &>/dev/null; then
    # Check if the masquerade rule already exists
    if ! nft list ruleset | grep -q "oif \"$WAN\" masquerade"; then
      nft add rule ip nat postrouting oif "$WAN" masquerade
    fi
  fi
done

# 4. Extra: Allow SSH access from VLAN (explicit rule in case the general accept rule fails)
nft add rule inet filter input iif "$VLAN_INTERFACE" tcp dport 12222 ct state new,established accept
nft add rule inet filter output oif "$VLAN_INTERFACE" tcp sport 12222 ct state established accept

echo "Successfully configured firewall rules for VLAN $VLAN_ID"

