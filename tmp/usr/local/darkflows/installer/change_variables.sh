#!/bin/bash

# Ensure net.ipv4.ip_forward=1 is set correctly in /etc/sysctl.conf

# Step 1: Remove any existing entries (commented or uncommented)
sed -i '/^#*net.ipv4.ip_forward=/d' /etc/sysctl.conf

# Step 2: Add the correct line
echo "net.ipv4.ip_forward=1" | tee -a /etc/sysctl.conf > /dev/null

# Step 3: Apply the changes immediately
sysctl -p

# Notify the user
echo "IP forwarding is now enabled in /etc/sysctl.conf and applied."

