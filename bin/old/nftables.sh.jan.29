#!/bin/bash

sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1

# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Set CAKE parameters (default to empty string if not defined)
COMMON_CAKE_PARAMS="${CAKE_PARAMS:-}"

# Flush existing rules
echo "Flushing iptables rules..."
iptables -F
iptables -t nat -F
iptables -t mangle -F
iptables -X

echo "Flushing nftables rules..."
nft flush ruleset

# Load and setup IFB
modprobe ifb || { echo "Failed to load ifb module"; exit 1; }

if ip link show ifb0 > /dev/null 2>&1; then
    echo "Deleting existing ifb0 interface..."
    ip link del ifb0 || { echo "Failed to delete ifb0 interface"; exit 1; }
fi

echo "Creating and enabling ifb0 interface..."
ip link add ifb0 type ifb || { echo "Failed to create ifb0 interface"; exit 1; }
ip link set ifb0 up || { echo "Failed to enable ifb0 interface"; exit 1; }

# Clear existing qdiscs
echo "Clearing existing qdisc configurations..."
tc qdisc del dev $PRIMARY_INTERFACE ingress 2>/dev/null || true
tc qdisc del dev $PRIMARY_INTERFACE root 2>/dev/null || true
tc qdisc del dev ifb0 root 2>/dev/null || true
tc qdisc del dev $INTERNAL_INTERFACE root 2>/dev/null || true
[ -n "$SECONDARY_INTERFACE" ] && tc qdisc del dev $SECONDARY_INTERFACE root 2>/dev/null || true

# Setup ingress redirect
echo "Setting up ingress redirection..."
tc qdisc add dev $PRIMARY_INTERFACE handle ffff: ingress || { echo "Failed to add ingress qdisc"; exit 1; }
tc filter add dev $PRIMARY_INTERFACE parent ffff: protocol all u32 match u32 0 0 action mirred egress redirect dev ifb0 || { echo "Failed to add redirect filter"; exit 1; }

### VERSION A START - AUTORATE-INGRESS ###
# Primary interface (Upload)
echo "Configuring CAKE for $PRIMARY_INTERFACE (egress)..."
tc qdisc add dev $PRIMARY_INTERFACE root cake \
    bandwidth ${PRIMARY_EGRESS_BANDWIDTH} \
    $COMMON_CAKE_PARAMS 

# IFB0 (Download) - Using autorate-ingress with baseline from config
echo "Configuring CAKE for ifb0 (ingress)..."
tc qdisc add dev ifb0 root cake \
    bandwidth ${PRIMARY_INGRESS_BANDWIDTH} \
    $COMMON_CAKE_PARAMS 


# Internal interface (same for both versions)
echo "Configuring CAKE for $INTERNAL_INTERFACE..."
tc qdisc add dev $INTERNAL_INTERFACE root cake \
    bandwidth ${INTERNAL_EGRESS_BANDWIDTH} \
    $COMMON_CAKE_PARAMS 

# Secondary interface (if configured)
if [ -n "$SECONDARY_INTERFACE" ]; then
    echo "Configuring CAKE for $SECONDARY_INTERFACE..."
    tc qdisc add dev $SECONDARY_INTERFACE root cake \
        bandwidth ${SECONDARY_EGRESS_BANDWIDTH} \
        $COMMON_CAKE_PARAMS 
fi

# Set default policies
nft add table inet filter
nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
nft add chain inet filter forward { type filter hook forward priority 0 \; policy drop \; }
nft add chain inet filter output { type filter hook output priority 0 \; policy accept \; }

# Allow all traffic on internal interface
nft add rule inet filter input iif $INTERNAL_INTERFACE accept

# NAT configuration
nft add table ip nat
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }
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

# NAT prerouting chain setup
nft add chain ip nat prerouting { type nat hook prerouting priority 100 \; }

# Port 5080 forwarding with Hairpin NAT
#nft add rule ip nat prerouting tcp dport 5080 ip saddr != 192.168.1.110 dnat to 192.168.1.110:5080
#nft add rule ip nat postrouting ip saddr 192.168.0.0/23 ip daddr 192.168.1.110 tcp dport 5080 snat to 192.168.1.1
#nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
#nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $INTERNAL_INTERFACE tcp sport 5080 ct state established accept
#nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
#nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE tcp sport 5080 ct state established accept
#if [ -n "$SECONDARY_INTERFACE" ]; then
#    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE tcp dport 5080 ct state new,established accept
#    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE tcp sport 5080 ct state established accept
#fi

# Allow traffic incoming from tailscale
nft add rule inet filter input iif "tailscale0" accept

# Verify final configuration
echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev $SECONDARY_INTERFACE
fi

echo "### Verifying nftables configuration ###"
nft list ruleset

echo "Configuration applied successfully."

#/usr/local/darkflows/bin/setup_blocking.sh
/usr/local/darkflows/bin/setup_secondwan.sh

