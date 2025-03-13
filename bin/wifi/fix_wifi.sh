#!/bin/bash

# Stop services
systemctl stop hostapd
systemctl stop wpa_supplicant 2>/dev/null

# Unblock wifi and set regulatory domain
rfkill unblock wifi
iw reg set US
sleep 1

# Remove interface from bridge if it exists
brctl delif br1 wlp44s0 2>/dev/null || true

# Reset interface
ip link set wlp44s0 down
sleep 1

# Set interface to AP mode
iw dev wlp44s0 set type ap
ip link set wlp44s0 up

# Add to bridge
brctl addif br1 wlp44s0 2>/dev/null || true

# Start hostapd in debug mode
echo "Starting hostapd in debug mode..."
hostapd -dd /etc/hostapd/hostapd.conf 