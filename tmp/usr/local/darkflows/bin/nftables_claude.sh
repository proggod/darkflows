#!/bin/bash

#######################################
# 1) Enable IP forwarding & disable IPv6
#######################################
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

#######################################
# 2) Load network config & flush tables
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
# 3) Setup IFB for inbound shaping
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
# 4) Clear existing qdiscs on WAN/ifb0
#######################################
echo "Clearing existing qdiscs on $PRIMARY_INTERFACE and ifb0..."
tc qdisc del dev "$PRIMARY_INTERFACE" ingress 2>/dev/null || true
tc qdisc del dev "$PRIMARY_INTERFACE" root 2>/dev/null || true
tc qdisc del dev ifb0 root 2>/dev/null || true

if [ -n "$SECONDARY_INTERFACE" ]; then
    tc qdisc del dev "$SECONDARY_INTERFACE" root 2>/dev/null || true
fi

#######################################
# 5) Redirect inbound (ingress) to ifb0
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
# 6) CAKE on WAN Egress
#    Using 'docsis' for cable overhead
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
# 7) CAKE on WAN Ingress (ifb0)
#######################################
echo "Setting up CAKE ingress on ifb0..."
tc qdisc replace dev ifb0 root handle 1: cake \
    bandwidth "${PRIMARY_INGRESS_BANDWIDTH}" \
    memlimit 32mb besteffort rtt 50ms \
    flows \
    dual-srchost dual-dsthost \
    docsis \
    ingress wash \
    split-gso || {
    echo "Failed to add CAKE to ifb0"
    exit 1
}

#######################################
# 8) nftables: Basic Firewall + NAT
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

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule ip nat postrouting oif "$SECONDARY_INTERFACE" masquerade
fi

# Forward LAN->WAN and related return traffic
nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$PRIMARY_INTERFACE" accept
nft add rule inet filter forward iif "$PRIMARY_INTERFACE" oif "$INTERNAL_INTERFACE" ct state established,related accept

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif "$INTERNAL_INTERFACE" oif "$SECONDARY_INTERFACE" accept
    nft add rule inet filter forward iif "$SECONDARY_INTERFACE" oif "$INTERNAL_INTERFACE" ct state established,related accept
fi

# Allow outgoing traffic and ICMP
nft add rule inet filter output ip protocol icmp accept
nft add rule inet filter input ip protocol icmp accept

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

########################################
# 9) DSCP marking and mangle setup
########################################
nft add table ip mangle
nft add chain ip mangle prerouting { type filter hook prerouting priority 0 \; }
nft add chain ip mangle postrouting { type filter hook postrouting priority 0 \; }

# Mark UDP gaming traffic (under 256 bytes)
nft add rule ip mangle prerouting meta l4proto udp udp length 0-256 ip dscp set 0x2e
nft add rule ip mangle postrouting meta l4proto udp udp length 0-256 ip dscp set 0x2e

# Mark all other UDP traffic
nft add rule ip mangle prerouting meta l4proto udp ip dscp set 0x20
nft add rule ip mangle postrouting meta l4proto udp ip dscp set 0x20

# Mark ICMP traffic
nft add rule ip mangle prerouting meta l4proto icmp ip dscp set 0x28
nft add rule ip mangle postrouting meta l4proto icmp ip dscp set 0x28

#######################################
# 10) Direct-action traffic classification
#######################################
echo "Setting up direct-action traffic classification..."

# Clear any existing filters
tc filter del dev ifb0 parent 1: 2>/dev/null

# Small UDP with direct-action
tc filter add dev ifb0 parent 1: protocol ip prio 1 \
    basic match 'meta(protocol eq udp) and meta(length lt 256)' \
    action gact goto 3

# ICMP with direct-action
tc filter add dev ifb0 parent 1: protocol ip prio 2 \
    basic match 'meta(protocol eq icmp)' \
    action gact goto 2

# Regular UDP with direct-action
tc filter add dev ifb0 parent 1: protocol ip prio 3 \
    basic match 'meta(protocol eq udp)' \
    action gact goto 2

echo "=== Verifying filters ==="
tc -s filter show dev ifb0

#######################################
# Final verification
#######################################
echo "### Final nftables ruleset ###"
nft list ruleset

echo "### Showing tc filters on ifb0 ###"
tc -s filter show dev ifb0

echo "### Showing tc qdisc on ifb0 ###"
tc -s qdisc show dev ifb0

echo "Configuration applied successfully."


