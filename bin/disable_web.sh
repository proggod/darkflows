#!/bin/bash
#
# disable_web_tc.sh
#
# Removes the HTB qdisc from the WAN interface, thus removing the 100 Mbps limit.

source /etc/darkflows/d_network.cfg || {
  echo "ERROR: Failed to source /etc/darkflows/d_network.cfg"
  exit 1
}

WAN_IFACE="$PRIMARY_INTERFACE"

echo "Disabling web shaping on $WAN_IFACE ..."
tc qdisc del dev "$WAN_IFACE" root 2>/dev/null || true

echo "Web shaping removed. Web traffic is no longer limited."

