#!/bin/bash
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1


# Source the network configuration file
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Flush existing nftables rules
echo "Flushing nftables rules..."
nft flush ruleset

# Create NAT table and postrouting chain
echo "Setting up NAT routing..."
nft add table ip nat
nft add chain ip nat postrouting { type nat hook postrouting priority 100 \; }

# Set up masquerade for NAT on primary interface
nft add rule ip nat postrouting oif $PRIMARY_INTERFACE masquerade

# Allow forwarding traffic between LAN and WAN
echo "Configuring forwarding rules..."
nft add table inet filter
nft add chain inet filter forward { type filter hook forward priority 0 \; policy drop \; }
nft add rule inet filter forward iif $INTERNAL_INTERFACE oif $PRIMARY_INTERFACE accept
nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $INTERNAL_INTERFACE ct state established,related accept

# Allow incoming traffic from the internal network
echo "Configuring local network rules..."
nft add chain inet filter input { type filter hook input priority 0 \; policy drop \; }
nft add rule inet filter input iif $INTERNAL_INTERFACE accept

# Allow established/related traffic
nft add rule inet filter input ct state established,related accept

# Allow loopback traffic
nft add rule inet filter input iif lo accept

# Allow outgoing traffic
nft add chain inet filter output { type filter hook output priority 0 \; policy accept \; }

echo "### Verifying nftables configuration ###"
nft list ruleset

echo "Basic NAT router configuration applied successfully."
