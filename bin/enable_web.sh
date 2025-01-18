#!/bin/bash
#
# enable_web_tc.sh
# 
# Marks web traffic in nftables (ports 80,443), then uses `tc` (HTB)
# to limit web traffic to 100 Mbps on $PRIMARY_INTERFACE.
#
# Requires:
#   - /etc/darkflows/d_network.cfg defining $PRIMARY_INTERFACE
#   - The "fw" (firewall) tc filter support in your kernel

# 1) Load your darkflows config (this must define PRIMARY_INTERFACE, etc.)
source /etc/darkflows/d_network.cfg || {
  echo "ERROR: Failed to source /etc/darkflows/d_network.cfg"
  exit 1
}

# You can change this if you want a different speed:
WEB_LIMIT_BANDWIDTH="100mbit"

# In your config, $PRIMARY_INTERFACE is your WAN or outward interface.
WAN_IFACE="$PRIMARY_INTERFACE"

echo "Enabling web shaping at $WEB_LIMIT_BANDWIDTH on interface: $WAN_IFACE"

################################################################################
# STEP A: Mark HTTP/HTTPS in nftables (if not already marked).
# Put these rules into the 'forward' chain so they match forwarded traffic.
################################################################################

echo "Marking TCP ports 80,443 in nftables with mark=0x1"
# If you already have these lines in your main nftables script, you can omit them here:
nft add rule inet filter forward tcp dport 80 meta mark set 0x1
nft add rule inet filter forward tcp dport 443 meta mark set 0x1

################################################################################
# STEP B: Attach an HTB qdisc in `tc` to shape traffic marked = 1
################################################################################

# 1) Clear any existing root qdisc on this interface
tc qdisc del dev "$WAN_IFACE" root 2>/dev/null

# 2) Create an HTB root qdisc with a default class
tc qdisc add dev "$WAN_IFACE" root handle 1: htb default 20

# 3) Create two classes:
#    - class 1:1 limited to $WEB_LIMIT_BANDWIDTH (for marked web traffic)
#    - class 1:20 unlimited or large rate for everything else
tc class add dev "$WAN_IFACE" parent 1: classid 1:1 htb rate $WEB_LIMIT_BANDWIDTH ceil $WEB_LIMIT_BANDWIDTH
tc class add dev "$WAN_IFACE" parent 1: classid 1:20 htb rate 1000mbit ceil 1000mbit

# 4) Filter by "fw mark=1" into the limited class (1:1)
#    'handle 1 fw' means it matches packets with mark=1
tc filter add dev "$WAN_IFACE" parent 1: protocol ip handle 1 fw flowid 1:1

echo "Web traffic now limited to $WEB_LIMIT_BANDWIDTH on $WAN_IFACE"

