#!/bin/bash

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Use 'su -' to switch to the root user."
  exit 1
fi

# Set the Pi-hole web interface password
PIHOLE_PASSWORD="darkflows"

# Generate a double-hashed password for Pi-hole
HASHED_PASSWORD=$(echo -n "$PIHOLE_PASSWORD" | sha256sum | awk '{printf $1}' | sha256sum | awk '{printf $1}')

# Create the setupVars.conf file with pre-configured settings
mkdir -p /etc/pihole
cat <<EOF > /etc/pihole/setupVars.conf
PIHOLE_INTERFACE=all
QUERY_LOGGING=true
INSTALL_WEB_SERVER=true
INSTALL_WEB_INTERFACE=true
LIGHTTPD_ENABLED=true
CACHE_SIZE=10000
DNS_FQDN_REQUIRED=true
DNS_BOGUS_PRIV=true
DNSMASQ_LISTENING=all
WEBPASSWORD=$HASHED_PASSWORD
BLOCKING_ENABLED=true
DNSSEC=false
REV_SERVER=false
PIHOLE_DNS_1=8.8.8.8
PIHOLE_DNS_2=1.1.1.1
EOF

# Install Pi-hole non-interactively
curl -sSL https://install.pi-hole.net | bash /dev/stdin --unattended

# Notify the user
echo "Pi-hole installation is complete. The web interface password is set to '$PIHOLE_PASSWORD'."



