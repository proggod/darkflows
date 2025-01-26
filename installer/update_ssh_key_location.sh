#!/bin/bash

# Define the custom directory for SSH keys
CUSTOM_KEY_BASE="/etc/ssh"

# Backup the existing SSH configuration file
echo "Backing up /etc/ssh/sshd_config to /etc/ssh/sshd_config.bak..."
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Remove any existing AuthorizedKeysFile lines
echo "Removing existing AuthorizedKeysFile lines from /etc/ssh/sshd_config..."
grep -v "AuthorizedKeysFile" /etc/ssh/sshd_config > /etc/ssh/sshd_config.tmp

# Add the correct AuthorizedKeysFile line to the end of the file
echo "Appending new AuthorizedKeysFile directive to /etc/ssh/sshd_config..."
echo "AuthorizedKeysFile %h/.ssh/authorized_keys $CUSTOM_KEY_BASE/%u/authorized_keys" >> /etc/ssh/sshd_config.tmp

# Replace the original configuration file with the updated one
echo "Removing existing /etc/ssh/sshd_config..."
rm -f /etc/ssh/sshd_config
echo "Replacing /etc/ssh/sshd_config with the updated version..."
mv /etc/ssh/sshd_config.tmp /etc/ssh/sshd_config

# Ensure the root user's SSH keys are copied to both locations
ROOT_SSH_DIR="/root/.ssh"
ROOT_CUSTOM_DIR="$CUSTOM_KEY_BASE/root"

# Create the root user's custom directory if it doesn't exist
echo "Creating root's custom directory: $ROOT_CUSTOM_DIR..."
mkdir -p "$ROOT_CUSTOM_DIR"

# Copy root's authorized_keys to the custom directory
if [ -f "$ROOT_SSH_DIR/authorized_keys" ]; then
    echo "Copying root's authorized_keys to $ROOT_CUSTOM_DIR/authorized_keys..."
    cp "$ROOT_SSH_DIR/authorized_keys" "$ROOT_CUSTOM_DIR/authorized_keys"
else
    echo "Creating empty authorized_keys file in $ROOT_CUSTOM_DIR..."
    touch "$ROOT_CUSTOM_DIR/authorized_keys"
fi

# Set proper permissions for the root user's custom directory and file
echo "Setting permissions for $ROOT_CUSTOM_DIR..."
chmod 700 "$ROOT_CUSTOM_DIR"
chmod 600 "$ROOT_CUSTOM_DIR/authorized_keys"
chown -R root:root "$ROOT_CUSTOM_DIR"

# Restart the SSH service to apply changes
echo "Restarting SSH service..."
systemctl restart ssh

echo "SSH configuration updated successfully."
echo "AuthorizedKeysFile now includes user-specific paths:"
echo "  - %h/.ssh/authorized_keys (user's home directory)"
echo "  - $CUSTOM_KEY_BASE/%u/authorized_keys (custom directory)"
echo "Root's SSH keys have been copied to both locations for testing:"
echo "  - $ROOT_SSH_DIR/authorized_keys"
echo "  - $ROOT_CUSTOM_DIR/authorized_keys"
echo "SSH service has been restarted."

