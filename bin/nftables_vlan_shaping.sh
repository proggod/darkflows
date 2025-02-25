#!/usr/bin/env bash
#
# vlan_traffic_shaping.sh - Standalone script to apply traffic shaping per VLAN.
# Usage: vlan_traffic_shaping.sh <VLAN_ID>
#
# Reads from /etc/darkflows/vlans.json:
#   - .egressBandwidth   (e.g. "5mbit")
#   - .ingressBandwidth  (e.g. "5mbit")
#   - .cakeParams        (optional, e.g. "besteffort nat dual-srchost")
#
# If either bandwidth is "" OR fails validation, we skip shaping for that direction.
#
# By default, uses TBF. If you prefer CAKE, just uncomment the CAKE lines.
#
# Adjust interface names (PARENT_INTERFACE, etc.) to match your setup.

set -e

# -----------
# 1) Checks
# -----------
if [ $# -ne 1 ]; then
  echo "Usage: $0 <VLAN_ID>"
  exit 1
fi

VLAN_ID="$1"
VLAN_JSON="/etc/darkflows/vlans.json"

if ! command -v jq &>/dev/null; then
  echo "ERROR: 'jq' is not installed. Please install (e.g. apt-get install jq)."
  exit 1
fi
if ! command -v tc &>/dev/null; then
  echo "ERROR: 'tc' is not installed. Please install (e.g. apt-get install iproute2)."
  exit 1
fi

# -----------
# 2) Config
# -----------
PARENT_INTERFACE="lan0"      # The base interface on which VLANs are created
VLAN_INTERFACE="$PARENT_INTERFACE.$VLAN_ID"
IFB_INTERFACE="ifb$VLAN_ID"   # We'll create/use "ifb<VLAN_ID>"

# -----------
# 3) Validate
# -----------
if ! ip link show dev "$VLAN_INTERFACE" &>/dev/null; then
  echo "ERROR: VLAN interface $VLAN_INTERFACE does not exist."
  exit 1
fi

# -----------
# 4) Parse JSON
# -----------
EGRESS_BW=$(jq -r ".[] | select(.id == ${VLAN_ID}) | .egressBandwidth" "$VLAN_JSON" 2>/dev/null || echo "")
INGRESS_BW=$(jq -r ".[] | select(.id == ${VLAN_ID}) | .ingressBandwidth" "$VLAN_JSON" 2>/dev/null || echo "")
CAKE_PARAMS=$(jq -r ".[] | select(.id == ${VLAN_ID}) | .cakeParams" "$VLAN_JSON" 2>/dev/null || echo "")

# If these fields come back as "null", treat them as empty
[ "$EGRESS_BW" = "null" ] && EGRESS_BW=""
[ "$INGRESS_BW" = "null" ] && INGRESS_BW=""
[ "$CAKE_PARAMS" = "null" ] && CAKE_PARAMS=""

# -----------
# 5) Helper function: Validate bandwidth string
#    Example valid strings:  "5mbit", "10kbit", "1gbit", "100bps" ...
# -----------
validate_bandwidth() {
  local BW="$1"
  # Must not be empty
  [ -z "$BW" ] && return 1
  # Regex for "one or more digits" + (kbit|mbit|gbit|bps)
  if [[ "$BW" =~ ^[0-9]+(kbit|mbit|gbit|bps)$ ]]; then
    return 0
  else
    return 1
  fi
}

# -----------
# 6) Egress Shaping
# -----------
if ! validate_bandwidth "$EGRESS_BW"; then
  echo "VLAN $VLAN_ID: egressBandwidth is empty or invalid ('$EGRESS_BW') — skipping egress shaping."
else
  echo "VLAN $VLAN_ID: applying egress shaping at $EGRESS_BW on $VLAN_INTERFACE..."
  tc qdisc del dev "$VLAN_INTERFACE" root 2>/dev/null || true

  # Example using TBF
  tc qdisc add dev "$VLAN_INTERFACE" root \
      tbf rate "$EGRESS_BW" burst 32k latency 400ms

  # If you prefer CAKE:
  # tc qdisc add dev "$VLAN_INTERFACE" root cake \
  #     bandwidth "$EGRESS_BW" $CAKE_PARAMS
fi

# -----------
# 7) Ingress Shaping
# -----------
if ! validate_bandwidth "$INGRESS_BW"; then
  echo "VLAN $VLAN_ID: ingressBandwidth is empty or invalid ('$INGRESS_BW') — skipping ingress shaping."
else
  echo "VLAN $VLAN_ID: applying ingress shaping at $INGRESS_BW via $IFB_INTERFACE..."

  modprobe ifb 2>/dev/null || true

  if ! ip link show dev "$IFB_INTERFACE" &>/dev/null; then
    ip link add "$IFB_INTERFACE" type ifb
  fi
  ip link set "$IFB_INTERFACE" up

  # Clear out old qdiscs
  tc qdisc del dev "$VLAN_INTERFACE" handle ffff: ingress 2>/dev/null || true
  tc qdisc del dev "$IFB_INTERFACE" root 2>/dev/null || true

  # Add ingress qdisc to the VLAN
  tc qdisc add dev "$VLAN_INTERFACE" handle ffff: ingress

  # Redirect inbound VLAN traffic to IFB
  tc filter add dev "$VLAN_INTERFACE" parent ffff: protocol all u32 match u32 0 0 \
      action mirred egress redirect dev "$IFB_INTERFACE"

  # Shape on IFB
  tc qdisc add dev "$IFB_INTERFACE" root \
      tbf rate "$INGRESS_BW" burst 32k latency 400ms

  # If you prefer CAKE:
  # tc qdisc add dev "$IFB_INTERFACE" root cake \
  #    bandwidth "$INGRESS_BW" $CAKE_PARAMS
fi

echo "Done. Traffic shaping script completed for VLAN $VLAN_ID ($VLAN_INTERFACE)."


