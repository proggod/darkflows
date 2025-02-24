#!/bin/bash
set -e

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root."
  exit 1
fi

# Load network configuration from /etc/darkflows/d_network.cfg
CONFIG_FILE="/etc/darkflows/d_network.cfg"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file $CONFIG_FILE not found."
  exit 1
fi

# shellcheck source=/etc/darkflows/d_network.cfg
source "$CONFIG_FILE"

# We assume:
#   PRIMARY_INTERFACE: the external (WAN) interface
#   INTERNAL_INTERFACE: the internal (LAN) interface

echo "Using PRIMARY_INTERFACE=$PRIMARY_INTERFACE as external interface."
echo "Using INTERNAL_INTERFACE=$INTERNAL_INTERFACE as internal interface."

# Update package lists
apt-get update

# Install miniupnpd. If prompts occur, simulate pressing Enter three times.
printf "\n\n\n" | apt-get install miniupnpd

# Backup any existing miniupnpd config
UPNP_CONF="/etc/miniupnpd/miniupnpd.conf"
if [ -f "$UPNP_CONF" ]; then
  cp "$UPNP_CONF" "${UPNP_CONF}.$(date +%s).bak"
  echo "Existing miniupnpd.conf backed up."
fi

# Determine the IP address for the internal interface.
INTERNAL_IP=$(ip addr show "$INTERNAL_INTERFACE" | awk '/inet / {print $2}' | cut -d/ -f1)
if [ -z "$INTERNAL_IP" ]; then
  echo "Error: Unable to determine IP for interface $INTERNAL_INTERFACE"
  exit 1
fi

# Generate a random UUID for this miniupnpd instance
if command -v uuidgen >/dev/null 2>&1; then
    GENERATED_UUID=$(uuidgen)
else
    # Fallback method if uuidgen is not available (requires /dev/urandom and awk)
    GENERATED_UUID=$(cat /proc/sys/kernel/random/uuid)
fi

# Write the minimal configuration file with only the required options.
cat > "$UPNP_CONF" <<EOF
system_uptime=yes
uuid=$GENERATED_UUID
force_igd_desc_v1=no
listening_ip=$INTERNAL_IP
ext_ifname=$PRIMARY_INTERFACE
EOF

echo "miniupnpd configuration written to $UPNP_CONF:"
echo "  system_uptime=yes"
echo "  uuid=$GENERATED_UUID"
echo "  force_igd_desc_v1=no"
echo "  listening_ip set to $INTERNAL_IP"
echo "  ext_ifname set to $PRIMARY_INTERFACE"

# Restart and enable miniupnpd service
systemctl restart miniupnpd
systemctl enable miniupnpd

echo "miniupnpd installed, configured, and started successfully."
