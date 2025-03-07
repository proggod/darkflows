#!/bin/bash
# Wifi Routing Setup Script for Darkflows
# This script sets up routing and firewall rules for the WiFi bridge interface
# Created by the wifi_setup.py script

# Check if WiFi has been set up by looking for hostapd configuration
if [ ! -f /etc/hostapd/hostapd.conf ]; then
  echo "WiFi not configured (no hostapd.conf found). Exiting."
  exit 0
fi

# Check if hostapd service is enabled
if ! systemctl is-enabled hostapd >/dev/null 2>&1; then
  echo "Hostapd service not enabled. Exiting."
  exit 0
fi

# Source the network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Check if the bridge interface is defined in the network config
if ! grep -q "bridge_ports" /etc/network/interfaces; then
  echo "No bridge configuration found in network interfaces. Exiting."
  exit 0
fi

# Make sure IP forwarding is enabled
sysctl -w net.ipv4.ip_forward=1

# Get the bridge interface from Darkflows config if not provided as argument
if [ -z "$1" ]; then
    # Extract the bridge name from the internal interface in d_network.cfg
    BRIDGE_NAME="$INTERNAL_INTERFACE"
    echo "Using bridge from d_network.cfg: $BRIDGE_NAME"
else
    BRIDGE_NAME="$1"
    echo "Using bridge from command line: $BRIDGE_NAME"
fi

# Wait for the bridge interface to be available
COUNTER=0
while [ $COUNTER -lt 30 ]; do
  if ip link show $BRIDGE_NAME >/dev/null 2>&1; then
    echo "Bridge $BRIDGE_NAME is available"
    break
  fi
  echo "Waiting for bridge $BRIDGE_NAME to become available..."
  sleep 1
  COUNTER=$((COUNTER + 1))
done

if ! ip link show $BRIDGE_NAME >/dev/null 2>&1; then
  echo "ERROR: Bridge $BRIDGE_NAME not found after waiting"
  exit 1
fi

# Ensure bridge is up
ip link set $BRIDGE_NAME up

# Add masquerade rule for the bridge if it doesn't exist
if ! nft list ruleset | grep -q "oif \"$BRIDGE_NAME\" masquerade"; then
    if nft list table ip nat > /dev/null 2>&1; then
        nft add rule ip nat postrouting oif "$BRIDGE_NAME" masquerade
        echo "Added masquerade rule for $BRIDGE_NAME"
    fi
fi

# Allow forwarding from bridge to WAN interfaces
if nft list table inet filter > /dev/null 2>&1; then
    # Add rules if they don't exist
    if ! nft list ruleset | grep -q "iif $BRIDGE_NAME oif \"$PRIMARY_INTERFACE\" accept"; then
        nft add rule inet filter forward iif $BRIDGE_NAME oif $PRIMARY_INTERFACE accept
        echo "Added forwarding rule from $BRIDGE_NAME to $PRIMARY_INTERFACE"
    fi
    
    if ! nft list ruleset | grep -q "iif \"$PRIMARY_INTERFACE\" oif $BRIDGE_NAME ct state"; then
        nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $BRIDGE_NAME ct state established,related accept
        echo "Added return traffic forwarding rule from $PRIMARY_INTERFACE to $BRIDGE_NAME"
    fi
    
    # If secondary interface is defined, add rules for it too
    if [ -n "$SECONDARY_INTERFACE" ]; then
        if ! nft list ruleset | grep -q "iif $BRIDGE_NAME oif \"$SECONDARY_INTERFACE\" accept"; then
            nft add rule inet filter forward iif $BRIDGE_NAME oif $SECONDARY_INTERFACE accept
            echo "Added forwarding rule from $BRIDGE_NAME to $SECONDARY_INTERFACE"
        fi
        
        if ! nft list ruleset | grep -q "iif \"$SECONDARY_INTERFACE\" oif $BRIDGE_NAME ct state"; then
            nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $BRIDGE_NAME ct state established,related accept
            echo "Added return traffic forwarding rule from $SECONDARY_INTERFACE to $BRIDGE_NAME"
        fi
    fi
    
    # Allow input from bridge
    if ! nft list ruleset | grep -q "iif \"$BRIDGE_NAME\" accept"; then
        nft add rule inet filter input iif $BRIDGE_NAME accept
        echo "Added input acceptance rule for $BRIDGE_NAME"
    fi
fi

echo "WiFi routing setup complete"
