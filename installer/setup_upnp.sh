ext_ifname=lan0
listening_ip=lan1
enable_natpmp=yes
enable_upnp=yes
secure_mode=yes
allow 1024-65535 0.0.0.0/0 1024-65535
deny 0-65535 0.0.0.0/0 0-65535
root@secret:/usr/local/darkflows/installer# cat setup_upnp.sh 
#!/bin/bash
# Ensure all package configuration runs noninteractively.
export DEBIAN_FRONTEND=noninteractive
export DEBIAN_PRIORITY=critical
set -e

# Load network configuration
if ! source /etc/darkflows/d_network.cfg; then
    echo "Failed to source network configuration"
    exit 1
fi

echo "Using PRIMARY_INTERFACE=${PRIMARY_INTERFACE}"
echo "Using INTERNAL_INTERFACE=${INTERNAL_INTERFACE}"

# Force debconf to use the noninteractive frontend
echo "debconf debconf/frontend select Noninteractive" | sudo debconf-set-selections

# Preconfigure debconf selections for miniupnpd
sudo debconf-set-selections <<EOF
miniupnpd miniupnpd/start_daemon boolean true
miniupnpd miniupnpd/ext_ifname string ${PRIMARY_INTERFACE}
EOF

# Install miniupnpd if it is not already installed.
if ! command -v miniupnpd &>/dev/null; then
    echo "Installing miniupnpd..."
    if command -v apt &>/dev/null; then
        sudo apt update && sudo apt install -y miniupnpd miniupnpc
    elif command -v pacman &>/dev/null; then
        sudo pacman -Sy --noconfirm miniupnpd miniupnpc
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y miniupnpd miniupnpc
    else
        echo "Unsupported package manager! Install miniupnpd manually."
        exit 1
    fi
else
    echo "miniupnpd is already installed."
fi

# Force miniupnpd to re-read the debconf selections
sudo dpkg-reconfigure -f noninteractive miniupnpd

# Write the miniupnpd configuration file using the variables from your config file.
UPNP_CONF="/etc/miniupnpd/miniupnpd.conf"
echo "Configuring miniupnpd in $UPNP_CONF..."
sudo tee "$UPNP_CONF" > /dev/null <<EOF
ext_ifname=${PRIMARY_INTERFACE}
listening_ip=${INTERNAL_INTERFACE}
enable_natpmp=yes
enable_upnp=yes
secure_mode=yes
allow 1024-65535 0.0.0.0/0 1024-65535
deny 0-65535 0.0.0.0/0 0-65535
EOF

# Setup nftables rules for UPnP using the internal interface.
echo "Setting up nftables rules for UPnP..."
sudo nft add rule inet filter input iif "${INTERNAL_INTERFACE}" udp dport 1900 accept   # SSDP Discovery
sudo nft add rule inet filter input iif "${INTERNAL_INTERFACE}" tcp dport 5000 accept   # UPnP Control
sudo nft add rule inet filter input iif "${INTERNAL_INTERFACE}" udp dport 5351 accept   # NAT-PMP
sudo nft add rule inet filter input iif "${INTERNAL_INTERFACE}" udp dport 1024-65535 accept  # Dynamic ports
sudo nft add rule inet filter forward ip protocol udp ct state established,related accept
sudo nft add rule inet filter forward ip protocol tcp ct state established,related accept

# Enable and restart the miniupnpd service
echo "Enabling and restarting miniupnpd..."
sudo systemctl enable miniupnpd
sudo systemctl restart miniupnpd

# Verify miniupnpd status and display nftables rules
echo "Verifying miniupnpd status..."
sudo systemctl status miniupnpd --no-pager

echo "Current nftables rules for UPnP:"
sudo nft list ruleset | grep -E '1900|5000|5351|1024-65535'

echo "UPnP setup completed successfully!"

