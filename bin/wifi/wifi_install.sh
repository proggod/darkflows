#!/bin/bash
# Installation script for the WiFi Setup utility

set -e  # Exit on error

INSTALL_DIR="/usr/local/darkflows/bin"
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

echo "Installing WiFi Setup Scripts to $INSTALL_DIR..."

# Ensure the directory exists
mkdir -p "$INSTALL_DIR"

# Copy the scripts
cp "$SCRIPT_DIR/wifi_setup.py" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/wifi_setup_wifi.py" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/wifi_setup_config.py" "$INSTALL_DIR/"

# Make scripts executable
chmod +x "$INSTALL_DIR/wifi_setup.py"
chmod +x "$INSTALL_DIR/wifi_setup_wifi.py"
chmod +x "$INSTALL_DIR/wifi_setup_config.py"

# Create a symlink in /usr/local/bin for easy access
if [ ! -e /usr/local/bin/wifi-setup ]; then
  ln -s "$INSTALL_DIR/wifi_setup.py" /usr/local/bin/wifi-setup
  echo "Created symlink: /usr/local/bin/wifi-setup -> $INSTALL_DIR/wifi_setup.py"
fi

# Install required packages
echo "Installing required dependencies..."
apt update
apt install -y python3

echo "Installation complete!"
echo "You can now run the setup with: python3 wifi_setup.py --ssid YOUR_WIFI_NAME --password YOUR_SECURE_PASSWORD"

