#!/bin/bash

# Define the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Define the installation directory
INSTALL_DIR="/usr/local/darkflows/installer"

# Step 1: Create the installation directory
echo "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Step 2: Extract the scripts archive (assumed to be in the same directory as this script)
SCRIPTS_ARCHIVE="$SCRIPT_DIR/darkflows_scripts.tgz"
echo "Extracting scripts from $SCRIPTS_ARCHIVE to $INSTALL_DIR"
tar zxvf "$SCRIPTS_ARCHIVE" -C /

# Step 3: Copy the configs archive (assumed to be in the same directory as this script)
CONFIGS_ARCHIVE="$SCRIPT_DIR/darkflows_configs.tgz"
echo "Copying configs from $CONFIGS_ARCHIVE to $INSTALL_DIR"
cp "$CONFIGS_ARCHIVE" "$INSTALL_DIR"

# Step 4: Make the installer script executable
INSTALLER_SCRIPT="$INSTALL_DIR/run_installers.sh"
echo "Making $INSTALLER_SCRIPT executable"
chmod +x "$INSTALLER_SCRIPT"

# Step 5: Run the installer script
echo "Running the installer script: $INSTALLER_SCRIPT"
"$INSTALLER_SCRIPT"

# Step 6: Clean up (optional)
# If you want to remove the archives after extraction, uncomment the following lines:
# echo "Cleaning up archives..."
# rm "$SCRIPTS_ARCHIVE" "$CONFIGS_ARCHIVE"

echo "First boot setup completed!"


