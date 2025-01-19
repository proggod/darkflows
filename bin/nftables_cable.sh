#!/bin/bash

#######################################
# Enable IP forwarding & disable IPv6 #
#######################################
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

#######################################
# Load network config & flush tables  #
#######################################
source /etc/darkflows/d_network.cfg || {
    echo "Failed to source /etc/darkflows/d_network.cfg"
    exit 1
}

echo "Flushing iptables rules..."
iptables -F
iptables -t nat -F
iptables -t mangle -F
iptables -X

echo "Flushing nftables rules..."
nft flush ruleset

#######################################
# Set up IFB for inbound traffic      #
#######################################
modprobe ifb || { echo "Failed to load ifb module"; exit 1; }

if ip link show ifb0 > /dev/null 2>&1; then
    echo "Deleting existing ifb0 interface..."
    ip link del ifb0 || { echo "Failed to delete ifb0"; exit 1; }
fi

echo "Creating and enabling ifb0 interface..."
ip link add ifb0 type ifb || { echo "Failed to create ifb0"; exit 1; }
ip link set ifb0 up || { echo "Failed to enable ifb0"; exit 1; }

#######################################
# Clear existing qdiscs               #
#######################################
echo "Clearing existing qdiscs on $PRIMARY_INTERFACE and ifb0..."
tc qdisc del dev "$PRIMARY_INTERFACE" ingress 2>/dev/null || true
tc qdisc del dev "$PRIMARY_INTERFACE" root 2>/dev/null || true
tc qdisc del dev ifb0 root 2>/dev/null || true

# If you have a SECONDARY_INTERFACE, also clear qdiscs on it
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc qdisc del dev "$SECONDARY_INTERFACE" root 2>/dev/null || true
fi

#######################################
# Redirect ingress to ifb0            #
#######################################
echo "Setting up ingress redirection for $PRIMARY_INTERFACE..."
tc qdisc add dev "$PRIMARY_INTERFACE" handle ffff: ingress || {
    echo "Failed to add ingress qdisc to $PRIMARY_INTERFACE"
    exit 1
}
tc filter add dev "$PRIMARY_INTERFACE" parent ffff: protocol ip u32 \
    match u32 0 0 action mirred egress redirect dev ifb0 || {
    echo "Failed to add ingress filter to $PRIMARY_INTERFACE"
    exit 1
}

#######################################
# Set up CAKE for egress (WAN)        #
#######################################
echo "Setting up CAKE egress on $PRIMARY_INTERFACE..."
tc qdisc add dev "$PRIMARY_INTERFACE" root cake \
    bandwidth "${PRIMARY_EGRESS_BANDWIDTH}" \
    memlimit 32mb diffserv4 rtt 50ms \
    dual-srchost dual-dsthost nat \
    docsis \
    ack-filter split-gso || {
    echo "Failed to add CAKE to $PRIMARY_INTERFACE"
    exit 1
}

# If you have a SECONDARY_INTERFACE, set up CAKE on it
if [ -n "$SECONDARY_INTERFACE" ]; then
    echo "Setting up CAKE egress on $SECONDARY_INTERFACE..."
    tc qdisc add dev "$SECONDARY_INTERFACE" root cake \
        bandwidth "${SECONDARY_EGRESS_BANDWIDTH}" \
        memlimit 32mb diffserv4 rtt 50ms \
        dual-srchost dual-dsthost nat \
        docsis \
        ack-filter split-gso || {
        echo "Failed to add CAKE to $SECONDARY_INTERFACE"
        exit 1
    }
fi

#######################################
# Set up CAKE for ingress (WAN->LAN)  #
#######################################
echo "Setting up CAKE ingress on ifb0..."
tc qdisc replace dev ifb0 root handle 1: cake \
    bandwidth "${PRIMARY_INGRESS_BANDWIDTH}" \
    memlimit 32mb diffserv4 rtt 50ms \
    dual-srchost dual-dsthost \
    docsis \
    nowash split-gso || {
    echo "Failed to add CAKE to ifb0"
    exit 1
}

##
# REMOVED: No shaping on the internal interface
##
#tc qdisc del dev "$INTERNAL_INTERFACE" root 2>/dev/null || true
# Optionally, if you want a default qdisc you can do:
# tc qdisc add dev "$INTERNAL_INTERFACE" root fq_codel

echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev "$PRIMARY_INTERFACE"
tc -s qdisc show dev ifb0
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev "$SECONDARY_INTERFACE"
fi

#######################################
# Basic nftables Firewall & NAT       #
#######################################
nft add table inet filter
nft add chain inet filter input    { type filter hook input priority 0 \; policy drop \; }
nft add chain inet filter forward  { type filter hook forward priority 0 \; policy drop \; }
nft add chain inet filter output   { type filter hook output priority 0 \; policy accept \; }

# Allow all traffic on internal interface
nft add rule inet filter input iif "$INTERNAL_INTERFACE" accept

# NAT for primary interface
nft add table ip nat
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }
nft add rule ip nat postrouting oif "$PRIMARY_INTERFACE" masquerade

# NAT for secondary interface if set
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule ip nat postrouting oif "$SECONDARY_INTERFACE" masquerade
fi

# Forward LAN->WAN and return traffic
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$PRIMARY_INTERFACE" accept
nft add rule inet filter forward iif "$PRIMARY_INTERFACE" oif "$INTERNAL_INTERFACE" ct state established,related accept

# Secondary interface forwarding if present
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$SECONDARY_INTERFACE" accept
    nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$INTERNAL_INTERFACE" ct state established,related accept
fi

# Allow outgoing traffic and ICMP
nft add rule inet filter output ip protocol icmp accept
nft add rule inet filter input  ip protocol icmp accept

# Loopback
nft add rule inet filter input iif lo accept

# Related/established inbound
nft add rule inet filter input ct state established,related accept

# Allow SSH on port 12222
nft add rule inet filter input iif "$PRIMARY_INTERFACE" tcp dport 12222 ct state new,established accept
nft add rule inet filter output oif "$PRIMARY_INTERFACE" tcp sport 12222 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter input iif "$SECONDARY_INTERFACE" tcp dport 12222 ct state new,established accept
    nft add rule inet filter output oif "$SECONDARY_INTERFACE" tcp sport 12222 ct state established accept
fi

#######################################
# Hairpin NAT examples (3080, 5080, 3000)
#######################################
nft add chain ip nat prerouting { type nat hook prerouting priority 100 \; }

# --- 3080 ---
nft add rule ip nat prerouting tcp dport 3080 ip saddr != 192.168.1.110 dnat to 192.168.1.110:3080
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 3080 snat to 192.168.1.1
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 3080 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp sport 3080 ct state established accept
nft add rule inet filter forward iif "$PRIMARY_INTERFACE"  oif "$INTERNAL_INTERFACE" tcp dport 3080 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$PRIMARY_INTERFACE"  tcp sport 3080 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 3080 ct state new,established accept
    nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$SECONDARY_INTERFACE" tcp sport 3080 ct state established accept
fi

# --- 5080 ---
nft add rule ip nat prerouting tcp dport 5080 ip saddr != 192.168.1.110 dnat to 192.168.1.110:5080
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 5080 snat to 192.168.1.1
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 5080 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp sport 5080 ct state established accept
nft add rule inet filter forward iif "$PRIMARY_INTERFACE"  oif "$INTERNAL_INTERFACE" tcp dport 5080 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$PRIMARY_INTERFACE"  tcp sport 5080 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 5080 ct state new,established accept
    nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$SECONDARY_INTERFACE" tcp sport 5080 ct state established accept
fi

# --- 3000 ---
echo "Redirect 3000 with Hairpin NAT"
nft add rule ip nat prerouting tcp dport 3000 ip saddr != 192.168.1.110 dnat to 192.168.1.110:3000
nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 3000 snat to 192.168.1.1
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 3000 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$INTERNAL_INTERFACE" tcp sport 3000 ct state established accept
nft add rule inet filter forward iif "$PRIMARY_INTERFACE"  oif "$INTERNAL_INTERFACE" tcp dport 3000 ct state new,established accept
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$PRIMARY_INTERFACE"  tcp sport 3000 ct state established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$INTERNAL_INTERFACE" tcp dport 3000 ct state new,established accept
    nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$SECONDARY_INTERFACE" tcp sport 3000 ct state established accept
fi

#######################################
# DSCP marking in ip mangle           #
#######################################
nft add table ip mangle
nft add chain ip mangle postrouting { type filter hook postrouting priority 0 \; }

# Mark VoIP traffic (SIP 5060, RTP 10000-20000) with DSCP EF (46)
nft add rule ip mangle postrouting udp dport 5060 ip dscp set ef
nft add rule ip mangle postrouting udp dport 10000-20000 ip dscp set ef

# Mark small packets (gaming) with DSCP CS4 (32) if length <128
nft add rule ip mangle postrouting ip length 0-128 ip dscp set cs4

# Allow Tailscale interface
nft add rule inet filter input iif "tailscale0" accept

#######################################
# Ingress DSCP-based classification   #
#######################################
echo "Adding filters to classify ingress (ifb0) based on DSCP..."

# EF (0x2E & 0xFC)
tc filter add dev ifb0 parent 1: protocol ip u32 \
    match ip tos 0x2e 0xfc action skbedit priority 3 || {
    echo "Failed to add filter for Voice (EF)"
    exit 1
}

# “Video” or AF32? (0x18 -> DSCP decimal 24)
tc filter add dev ifb0 parent 1: protocol ip u32 \
    match ip tos 0x18 0xfc action skbedit priority 2 || {
    echo "Failed to add filter for DSCP=24"
    exit 1
}

# Best Effort? (0x08 = CS1 if no ECN bits)
tc filter add dev ifb0 parent 1: protocol ip u32 \
    match ip tos 0x08 0xfc action skbedit priority 1 || {
    echo "Failed to add filter for Best Effort"
    exit 1
}

#######################################
# Final verification                  #
#######################################
echo "### Final nftables ruleset ###"
nft list ruleset

echo "Configuration applied successfully."

