#!/usr/bin/env bash
#
# setup_all_vlans.sh - Call nftables_vlan_ifb.sh for each VLAN ID in vlans.json
#

set -e

VLANS_JSON="/etc/darkflows/vlans.json"
NFTABLES_SCRIPT="/usr/local/darkflows/bin/nftables_vlan_min.sh"

if [ ! -f "$VLANS_JSON" ]; then
  echo "ERROR: Missing $VLANS_JSON"
  exit 1
fi

if [ ! -x "$NFTABLES_SCRIPT" ]; then
  echo "ERROR: $NFTABLES_SCRIPT not found or not executable"
  exit 1
fi

# We need 'jq' to parse JSON
if ! command -v jq &>/dev/null; then
  echo "ERROR: 'jq' is not installed. Please install (e.g., apt-get install jq)."
  exit 1
fi

# Loop through each VLAN ID in the JSON
for VLAN_ID in $(jq -r '.[].id' "$VLANS_JSON"); do
  echo "=== Configuring VLAN with ID $VLAN_ID ==="
  "$NFTABLES_SCRIPT" "$VLAN_ID"
  echo
done

echo "All VLANs configured!"

