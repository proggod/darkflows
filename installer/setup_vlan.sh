#!/bin/bash

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Install the required package (vlan)
echo "Installing the 'vlan' package..."
apt-get update
apt-get install -y vlan

# Load the 8021q kernel module
echo "Loading the 8021q kernel module..."
modprobe 8021q

# Ensure the module is loaded on boot
echo "Adding 8021q module to /etc/modules..."

# Check if the module is already in /etc/modules (commented or uncommented)
if grep -q -E "^\s*#?\s*8021q\s*$" /etc/modules; then
  # If the line exists but is commented out, uncomment it
  sed -i -E "s/^\s*#?\s*8021q\s*$/8021q/" /etc/modules
  echo "Uncommented existing 8021q entry in /etc/modules."
else
  # If the line doesn't exist, add it
  echo "8021q" >> /etc/modules
  echo "Added 8021q to /etc/modules."
fi

echo "VLAN support has been set up successfully."

