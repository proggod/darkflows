#!/bin/bash
set -e

source /etc/darkflows/d_network.cfg || {
    echo "Failed to source network config"
    exit 1
}

# We need the same environment info as in the add script:
IP_RANGE=$(ip -4 addr show dev "$INTERNAL_INTERFACE" | awk '/inet/ {print $2}')
ROUTER_LAN_IP=$(ip -4 addr show dev "$INTERNAL_INTERFACE" | awk '/inet / { sub(/\/.*/, "", $2); print $2 }')
WAN_IP=$(ip -4 addr show dev "$PRIMARY_INTERFACE" | awk '/inet / { sub(/\/.*/, "", $2); print $2 }')

if [ $# -ne 3 ]; then
    echo "Usage: $0 <external_port> <internal_ip> <internal_port>"
    exit 1
fi

EXT_PORT=$1
TARGET_IP=$2
INT_PORT=$3

echo "Removing forward from external:$EXT_PORT to $TARGET_IP:$INT_PORT"

###############################################################################
# 1) Delete NAT rules (prerouting DNAT and postrouting SNAT)
###############################################################################
nft -a list ruleset 2>/dev/null | \
awk -v eport="$EXT_PORT" \
    -v tip="$TARGET_IP" \
    -v iport="$INT_PORT" \
    -v wanip="$WAN_IP" \
    -v lanip="$ROUTER_LAN_IP" \
    '
/(dnat|snat) to/ {
  # Grab the "handle X" text
  match($0, /handle [0-9]+/)
  if (RLENGTH == 0) next
  rule_handle = substr($0, RSTART, RLENGTH)

  # --- DNAT REMOVAL ---
  # Typical external DNAT rule:
  #   iif "wan0" tcp dport eport dnat to tip:iport
  # Hairpin DNAT rule:
  #   iif "lan0" ip daddr wanip tcp dport eport dnat to tip:iport

  if (index($0, "dnat to " tip ":" iport) > 0) {
    # Check if it has "tcp dport eport"
    if (match($0, /tcp dport ([0-9]+)/, arr)) {
      if (arr[1] == eport) {
        print "delete rule ip nat prerouting " rule_handle
      }
    }
  }

  # --- SNAT REMOVAL ---
  # Typical external SNAT rule:
  #   ip saddr X ip daddr tip tcp dport iport snat to <something>
  # Hairpin SNAT rule:
  #   iif "lan0" oif "lan0" ip saddr X ip daddr tip tcp dport iport snat to lanip

  else if (index($0, "snat to ") > 0) {
    # We check if it references tip + iport
    if (index($0, tip) > 0 && index($0, iport) > 0) {
      # That should catch both the external SNAT and the hairpin SNAT
      print "delete rule ip nat postrouting " rule_handle
    }
  }
}
' | while read -r cmd; do
    nft $cmd
done

###############################################################################
# 2) Delete FORWARD rules in the filter table
###############################################################################
nft -a list chain inet filter forward 2>/dev/null | \
awk -v tip="$TARGET_IP" -v iport="$INT_PORT" '
/tcp (dport|sport).*ct state/ {
  match($0, /handle [0-9]+/)
  if (RLENGTH == 0) next
  rule_handle = substr($0, RSTART, RLENGTH)

  # For forward rules referencing "tcp dport iport" or "tcp sport iport" + tip
  if ((index($0, "dport " iport) > 0 && index($0, tip) > 0) || \
      (index($0, "sport " iport) > 0 && index($0, tip) > 0)) {
    print "delete rule inet filter forward " rule_handle
  }
}
' | while read -r cmd; do
    nft $cmd
done

echo "Removed port forward external:$EXT_PORT → $TARGET_IP:$INT_PORT"

