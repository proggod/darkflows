#!/bin/bash

# Disable IPv6 if desired
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Flush existing iptables rules and delete user-defined chains
echo "Flushing iptables rules..."
iptables -F
iptables -t nat -F
iptables -t mangle -F
iptables -X

# Flush existing nftables rules and delete user-defined chains
echo "Flushing nftables rules..."
nft flush ruleset

# Load the ifb module for ingress traffic
modprobe ifb || { echo "Failed to load ifb module"; exit 1; }

# Check if ifb0 already exists, and delete it if it does
if ip link show ifb0 > /dev/null 2>&1; then
    echo "Deleting existing ifb0 interface..."
    ip link del ifb0 || { echo "Failed to delete ifb0 interface"; exit 1; }
fi

# Create and enable the ifb0 interface
echo "Creating and enabling ifb0 interface..."
ip link add ifb0 type ifb || { echo "Failed to create ifb0 interface"; exit 1; }
ip link set ifb0 up || { echo "Failed to enable ifb0 interface"; exit 1; }

# Clear existing ingress qdisc on the primary interface (if it exists)
echo "Clearing existing ingress qdisc on $PRIMARY_INTERFACE..."
tc qdisc del dev $PRIMARY_INTERFACE ingress 2>/dev/null || true

# Redirect ingress traffic from the primary interface to ifb0
echo "Setting up ingress traffic redirection from $PRIMARY_INTERFACE to ifb0..."
tc qdisc add dev $PRIMARY_INTERFACE handle ffff: ingress || { echo "Failed to add ingress qdisc to $PRIMARY_INTERFACE"; exit 1; }
tc filter add dev $PRIMARY_INTERFACE parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0 || { echo "Failed to add ingress filter to $PRIMARY_INTERFACE"; exit 1; }

# Clear existing CAKE configurations
echo "Clearing existing CAKE configurations..."
tc qdisc del dev $PRIMARY_INTERFACE root 2>/dev/null || true
tc qdisc del dev ifb0 root 2>/dev/null || true
tc qdisc del dev $INTERNAL_INTERFACE root 2>/dev/null || true
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc qdisc del dev $SECONDARY_INTERFACE root 2>/dev/null || true
fi

# Set up CAKE for egress traffic on the primary interface
echo "Setting up CAKE for egress traffic on $PRIMARY_INTERFACE..."
tc qdisc add dev $PRIMARY_INTERFACE root cake bandwidth ${PRIMARY_EGRESS_BANDWIDTH} nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to add CAKE to $PRIMARY_INTERFACE"; exit 1; }

# Set up CAKE for egress traffic on the secondary interface (if configured)
if [ -n "$SECONDARY_INTERFACE" ]; then
    echo "Setting up CAKE for egress traffic on $SECONDARY_INTERFACE..."
    tc qdisc add dev $SECONDARY_INTERFACE root cake bandwidth ${SECONDARY_EGRESS_BANDWIDTH} nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to add CAKE to $SECONDARY_INTERFACE"; exit 1; }
fi

# Set up CAKE for ingress traffic (download) on ifb0 with an explicit handle
echo "Setting up CAKE for ingress traffic on ifb0..."
tc qdisc replace dev ifb0 root handle 1: cake bandwidth ${PRIMARY_INGRESS_BANDWIDTH} memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter nowash split-gso || { echo "Failed to add CAKE to ifb0"; exit 1; }

# Set up CAKE for local traffic on the internal interface
echo "Setting up CAKE for local traffic on $INTERNAL_INTERFACE..."
tc qdisc add dev $INTERNAL_INTERFACE root cake bandwidth ${INTERNAL_EGRESS_BANDWIDTH} memlimit 64mb besteffort rtt 50ms ack-filter split-gso || { echo "Failed to add CAKE to $INTERNAL_INTERFACE"; exit 1; }

echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev $SECONDARY_INTERFACE
fi

###############################################################################
# TABLE: inet filter
###############################################################################
# Set default policies to DROP (blocking all traffic by default),
# allowing specific traffic afterward.
nft add table inet filter
nft add chain inet filter input "{ type filter hook input priority 0; policy drop; }"
nft add chain inet filter forward "{ type filter hook forward priority 0; policy drop; }"
nft add chain inet filter output "{ type filter hook output priority 0; policy accept; }"

# Allow all traffic on the internal interface (local network)
nft add rule inet filter input iif $INTERNAL_INTERFACE accept

# Setting up nftables rules for routing and NAT
nft add table ip nat
nft add chain ip nat postrouting "{ type nat hook postrouting priority 100; }"
nft add rule ip nat postrouting oif $PRIMARY_INTERFACE masquerade

# Add masquerade rule for secondary interface if it is set
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule ip nat postrouting oif $SECONDARY_INTERFACE masquerade
fi

# Allow forwarding traffic from LAN to WAN and related return traffic
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE ct state established,related accept

# Add forwarding rules for secondary interface if it is set
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE accept
    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE ct state established,related accept
fi

# Allow outgoing traffic and ICMP for ping
nft add rule inet filter output ip protocol icmp accept
nft add rule inet filter input ip protocol icmp accept

# Allow all loopback traffic
nft add rule inet filter input iif lo accept

# Allow related incoming traffic for outgoing connections
nft add rule inet filter input ct state established,related accept

# Allow SSH on port 12222
nft add rule inet filter input iif $PRIMARY_INTERFACE tcp dport 12222 ct state new,established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter input iif $SECONDARY_INTERFACE tcp dport 12222 ct state new,established accept
    nft add rule inet filter output oif $SECONDARY_INTERFACE tcp sport 12222 ct state established accept
fi
nft add rule inet filter output oif $PRIMARY_INTERFACE tcp sport 12222 ct state established accept

###############################################################################
# HAIRPIN NAT RULES
###############################################################################
# Redirect 3080 with Hairpin NAT
nft add chain ip nat prerouting "{ type nat hook prerouting priority 100; }"
nft add rule ip nat prerouting tcp dport 3080 ip saddr != 192.168.1.110 dnat to 192.168.1.110:3080
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 3080 snat to 192.168.1.1
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3080 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp sport 3080 ct state established accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3080 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE tcp sport 3080 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3080 ct state new,established accept
    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE tcp sport 3080 ct state established accept
fi

# Redirect 5080 with Hairpin NAT
nft add rule ip nat prerouting tcp dport 5080 ip saddr != 192.168.1.110 dnat to 192.168.1.110:5080
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 5080 snat to 192.168.1.1
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp sport 5080 ct state established accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE tcp sport 5080 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE tcp sport 5080 ct state established accept
fi

# Redirect 3000 with Hairpin NAT
nft add rule ip nat prerouting tcp dport 3000 ip saddr != 192.168.1.110 dnat to 192.168.1.110:3000
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 3000 snat to 192.168.1.1
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3000 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp sport 3000 ct state established accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3000 ct state new,established accept
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE tcp sport 3000 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 3000 ct state new,established accept
    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE tcp sport 3000 ct state established accept
fi

###############################################################################
# TABLE: ip mangle (for DSCP marking + NEW prerouting chain)
###############################################################################
nft add table ip mangle

# We already have a 'postrouting' chain for DSCP marking
nft add chain ip mangle postrouting "{ type filter hook postrouting priority 0; }"

# Mark VoIP traffic (SIP and RTP) with DSCP EF (46)
nft add rule ip mangle postrouting udp dport 5060 ip dscp set ef  # SIP
nft add rule ip mangle postrouting udp dport 10000-20000 ip dscp set ef  # RTP

# Mark small packets (gaming traffic) with DSCP CS4 (32)
nft add rule ip mangle postrouting ip length 0-128 ip dscp set cs4  # Small packets

# NEW: create a PREROUTING chain in 'ip mangle' for web marking
nft add chain ip mangle prerouting "{ type filter hook prerouting priority -150; policy accept; }"
# Mark inbound traffic on tcp/80 or tcp/443 with mark=0x1
nft add rule ip mangle prerouting tcp dport 80 meta mark set 0x1
nft add rule ip mangle prerouting tcp dport 443 meta mark set 0x1

###############################################################################
# ALLOW traffic incoming from tailscale
###############################################################################
nft add rule inet filter input iif "tailscale0" accept

echo "Adding filters to classify ingress traffic..."
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x2e 0xfc action skbedit priority 3 || { echo "Failed to add filter for Voice (EF)"; exit 1; }
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x18 0xfc action skbedit priority 2 || { echo "Failed to add filter for Video (AF41)"; exit 1; }
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x08 0xfc action skbedit priority 1 || { echo "Failed to add filter for Best Effort (CS1)"; exit 1; }

echo "### Verifying nftables configuration ###"
nft list ruleset

echo "Configuration applied successfully."


