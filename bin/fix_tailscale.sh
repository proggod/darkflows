#!/bin/bash

# Remove immutable attribute from resolv.conf
tailscale down
systemctl stop tailscaled
chattr -i /etc/resolv.conf

# Create the new resolv.conf content
cat > /etc/resolv.conf << EOF
nameserver 100.100.100.100
nameserver 8.8.8.8
search taileafff2.ts.net
EOF

# Set immutable attribute back on resolv.conf
chattr +i /etc/resolv.conf
systemctl start tailscaled
tailscale up

echo "resolv.conf has been updated successfully."

