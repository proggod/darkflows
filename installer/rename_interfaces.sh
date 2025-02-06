#!/bin/bash

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Detect Ethernet and USB interfaces (ignore wireless, virtual, etc.)
INTERFACES=($(ls /sys/class/net | grep -E '^(enp|enx|eth|usb)' | grep -vE '^(lo|wlp|virbr|veth|tun|tap)'))
if [ ${#INTERFACES[@]} -eq 0 ]; then
  echo "No Ethernet or USB interfaces found!"
  exit 1
fi

# Limit to 5 interfaces
if [ ${#INTERFACES[@]} -gt 5 ]; then
  INTERFACES=("${INTERFACES[@]:0:5}")
  echo "Warning: More than 5 interfaces detected. Only renaming the first 5."
fi

# Define new names
NEW_NAMES=("lan0" "lan1" "lan2" "lan3" "lan4")

# Create or clear the systemd network directory
SYSTEMD_NETWORK_DIR="/etc/systemd/network"
mkdir -p "$SYSTEMD_NETWORK_DIR"
rm -f "$SYSTEMD_NETWORK_DIR"/10-persistent-net-*.link

# Generate .link files and map old names to new names
declare -A NAME_MAP
for i in "${!INTERFACES[@]}"; do
  OLD_NAME="${INTERFACES[$i]}"
  NEW_NAME="${NEW_NAMES[$i]}"
  MAC=$(cat /sys/class/net/"$OLD_NAME"/address)
  LINK_FILE="$SYSTEMD_NETWORK_DIR/10-persistent-net-$NEW_NAME.link"
  cat <<EOF > "$LINK_FILE"
[Match]
MACAddress=$MAC

[Link]
Name=$NEW_NAME
EOF
  NAME_MAP["$OLD_NAME"]="$NEW_NAME"
done

# Update /etc/network/interfaces
INTERFACES_FILE="/etc/network/interfaces"
if [ -f "$INTERFACES_FILE" ]; then
  for OLD_NAME in "${!NAME_MAP[@]}"; do
    NEW_NAME="${NAME_MAP[$OLD_NAME]}"
    sed -i "s/$OLD_NAME/$NEW_NAME/g" "$INTERFACES_FILE"
  done
else
  echo "File $INTERFACES_FILE not found!"
fi

/usr/local/darkflows/installer/update-kea-interface.sh "${NAME_MAP[$OLD_NAME]}"


# Update /etc/darkflows/d_network.cfg
DARKFLOWS_NETWORK_FILE="/etc/darkflows/d_network.cfg"
if [ -f "$DARKFLOWS_NETWORK_FILE" ]; then
  for OLD_NAME in "${!NAME_MAP[@]}"; do
    NEW_NAME="${NAME_MAP[$OLD_NAME]}"
    sed -i "s/$OLD_NAME/$NEW_NAME/g" "$DARKFLOWS_NETWORK_FILE"
  done
else
  echo "File $DARKFLOWS_NETWORK_FILE not found!"
fi

# Reload systemd-networkd and trigger udev
systemctl restart systemd-networkd
udevadm control --reload
udevadm trigger

echo "Interface renaming complete. Reboot to apply changes."


