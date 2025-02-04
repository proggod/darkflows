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

# Step 3: Run the update script
UPDATE_SCRIPT="$INSTALL_DIR/run_update.sh"
echo "Running update script: $UPDATE_SCRIPT"
chmod +x "$UPDATE_SCRIPT"
"$UPDATE_SCRIPT"

# Step 4: Clean up (optional)
# If you want to remove the archive after extraction, uncomment the following line:
# echo "Cleaning up archive..."
# rm "$SCRIPTS_ARCHIVE"

echo "Update process completed!"


