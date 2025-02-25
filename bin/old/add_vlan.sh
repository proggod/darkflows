#!/bin/bash

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Check for correct usage
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <parent-interface> <ip-address> <subnet-mask>"
  echo "Example: $0 lan0 192.168.20.1 255.255.255.0"
  exit 1
fi

PARENT_INTERFACE="$1"
IP_ADDRESS="$2"
SUBNET_MASK="$3"

# Find the next available VLAN ID
echo "Finding the next available VLAN ID..."
NEXT_VLAN_ID=1
while ip link show | grep -q "${PARENT_INTERFACE}.${NEXT_VLAN_ID}"; do
  NEXT_VLAN_ID=$((NEXT_VLAN_ID + 1))
done

# Create the VLAN interface
VLAN_INTERFACE="${PARENT_INTERFACE}.${NEXT_VLAN_ID}"
echo "Creating VLAN interface ${VLAN_INTERFACE} with VLAN ID ${NEXT_VLAN_ID}..."
ip link add link ${PARENT_INTERFACE} name ${VLAN_INTERFACE} type vlan id ${NEXT_VLAN_ID}
ip link set ${VLAN_INTERFACE} up

# Assign the specified IP and subnet
echo "Assigning IP ${IP_ADDRESS} with subnet mask ${SUBNET_MASK} to ${VLAN_INTERFACE}..."
ip addr add ${IP_ADDRESS}/${SUBNET_MASK} dev ${VLAN_INTERFACE}

# Add the VLAN interface to /etc/network/interfaces for persistence
echo "Configuring ${VLAN_INTERFACE} in /etc/network/interfaces..."
cat <<EOF >> /etc/network/interfaces
auto ${VLAN_INTERFACE}
iface ${VLAN_INTERFACE} inet static
    vlan-raw-device ${PARENT_INTERFACE}
    address ${IP_ADDRESS}
    netmask ${SUBNET_MASK}
EOF

echo "VLAN interface ${VLAN_INTERFACE} has been created and configured successfully."


