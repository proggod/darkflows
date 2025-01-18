#!/bin/bash

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

# -------------------- CAKE Setup for Dynamic Bandwidth -------------------- #
# Instead of specifying a fixed bandwidth, we start with "unlimited" and
# let a background script adjust it as your cable modem speeds fluctuate.

echo "Setting up CAKE for dynamic bandwidth on $PRIMARY_INTERFACE..."
tc qdisc add dev $PRIMARY_INTERFACE root cake bandwidth unlimited nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to add CAKE to $PRIMARY_INTERFACE"; exit 1; }

if [ -n "$SECONDARY_INTERFACE" ]; then
    echo "Setting up CAKE for dynamic bandwidth on $SECONDARY_INTERFACE..."
    tc qdisc add dev $SECONDARY_INTERFACE root cake bandwidth unlimited nat memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter split-gso || { echo "Failed to add CAKE to $SECONDARY_INTERFACE"; exit 1; }
fi

echo "Setting up CAKE for dynamic bandwidth on ifb0..."
tc qdisc replace dev ifb0 root handle 1: cake bandwidth unlimited memlimit 32mb diffserv4 rtt 50ms triple-isolate ack-filter nowash split-gso || { echo "Failed to add CAKE to ifb0"; exit 1; }

echo "Setting up CAKE on $INTERNAL_INTERFACE (local traffic)..."
tc qdisc add dev $INTERNAL_INTERFACE root cake bandwidth unlimited memlimit 64mb besteffort rtt 50ms ack-filter split-gso || { echo "Failed to add CAKE to $INTERNAL_INTERFACE"; exit 1; }

# A simple script to dynamically update bandwidth
cat << 'EOF' > /usr/local/bin/update_cake_bandwidth.sh
#!/bin/bash
# Example dynamic script; replace "get_current_speed" with your method:
# e.g., parse cable modem stats, or use a speed test API, etc.

while true; do
    # For demonstration, let's say get_current_speed returns "20000" for 20Mbps
    # You must implement get_current_speed yourself.
    CURRENT_SPEED_DOWN=$(get_current_speed down) # e.g. 20000
    CURRENT_SPEED_UP=$(get_current_speed up)     # e.g. 2000

    if [ -n "$CURRENT_SPEED_UP" ]; then
        tc qdisc change dev $PRIMARY_INTERFACE root cake bandwidth ${CURRENT_SPEED_UP}kbit
        if [ -n "$SECONDARY_INTERFACE" ]; then
            tc qdisc change dev $SECONDARY_INTERFACE root cake bandwidth ${CURRENT_SPEED_UP}kbit
        fi
    fi

    if [ -n "$CURRENT_SPEED_DOWN" ]; then
        tc qdisc change dev ifb0 root cake bandwidth ${CURRENT_SPEED_DOWN}kbit
    fi

    # Optionally also adjust the internal interface if needed
    # tc qdisc change dev $INTERNAL_INTERFACE root cake bandwidth <some_value>kbit

    sleep 10
done
EOF

chmod +x /usr/local/bin/update_cake_bandwidth.sh
echo "Dynamic bandwidth script created at /usr/local/bin/update_cake_bandwidth.sh"
echo "Run it (in background or via systemd) to continuously adjust speeds."

echo "### Verifying CAKE configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0
tc -s qdisc show dev $INTERNAL_INTERFACE
if [ -n "$SECONDARY_INTERFACE" ]; then
    tc -s qdisc show dev $SECONDARY_INTERFACE
fi


# ====================== FIREWALL & NAT (UNCHANGED) ===================== #
nft add table inet filter
nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
nft add chain inet filter forward { type filter hook forward priority 0 \; policy drop \; }
nft add chain inet filter output { type filter hook output priority 0 \; policy accept \; }

nft add rule inet filter input iif $INTERNAL_INTERFACE accept

nft add table ip nat
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }
nft add rule ip nat postrouting oif $PRIMARY_INTERFACE masquerade

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule ip nat postrouting oif $SECONDARY_INTERFACE masquerade
fi

nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE ct state established,related accept

if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $SECONDARY_INTERFACE accept
    nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $INTERNAL_INTERFACE ct state established,related accept
fi

nft add rule inet filter output ip protocol icmp accept
nft add rule inet filter input ip protocol icmp accept

nft add rule inet filter input iif lo accept
nft add rule inet filter input ct state established,related accept

nft add rule inet filter input iif $PRIMARY_INTERFACE tcp dport 12222 ct state new,established accept
if [ -n "$SECONDARY_INTERFACE" ]; then
    nft add rule inet filter input iif $SECONDARY_INTERFACE tcp dport 12222 ct state new,established accept
    nft add rule inet filter output oif $SECONDARY_INTERFACE tcp sport 12222 ct state established accept
fi
nft add rule inet filter output oif $PRIMARY_INTERFACE tcp sport 12222 ct state established accept

nft add chain ip nat prerouting { type nat hook prerouting priority 100 \; }
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

# DSCP marking for VoIP/Gaming
nft add table ip mangle
nft add chain ip mangle postrouting { type filter hook postrouting priority 0 \; }

# Mark VoIP with EF
nft add rule ip mangle postrouting udp dport 5060 ip dscp set ef
nft add rule ip mangle postrouting udp dport 10000-20000 ip dscp set ef

# Mark small gaming packets with CS4
nft add rule ip mangle postrouting ip length 0-128 ip dscp set cs4

# Optionally mark all UDP as EF (uncomment if desired)
# nft add rule ip mangle postrouting udp ip dscp set ef

# allow traffic incoming from tailscale
nft add rule inet filter input iif "tailscale0" accept

# Classify ingress based on DSCP
echo "Adding filters to classify ingress traffic..."
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x2e 0xfc action skbedit priority 3
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x18 0xfc action skbedit priority 2
tc filter add dev ifb0 parent 1: protocol ip u32 match ip tos 0x08 0xfc action skbedit priority 1

echo "### Verifying nftables configuration ###"
nft list ruleset

echo "Configuration applied successfully."
echo "NOTE: Run '/usr/local/bin/update_cake_bandwidth.sh &' to dynamically adjust bandwidth."

