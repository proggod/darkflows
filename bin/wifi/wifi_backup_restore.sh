#!/bin/bash

BACKUP_DIR="/usr/local/darkflows/backups/wifi_setup"
CONFIG_FILES=(
    "/etc/network/interfaces"
    "/etc/hostapd/hostapd.conf"
    "/etc/default/hostapd"
    "/etc/darkflows/d_network.cfg"
    "/etc/kea/kea-dhcp4.conf"
    "/etc/sysctl.conf"
)

backup() {
    echo "Creating backup of WiFi configuration files..."
    
    # Create backup directory with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
    mkdir -p "$BACKUP_PATH"
    
    # Backup each file if it exists
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$file" ]; then
            dir_path="$BACKUP_PATH$(dirname "$file")"
            mkdir -p "$dir_path"
            cp -p "$file" "$BACKUP_PATH$file"
            echo "Backed up: $file"
        fi
    done
    
    echo "Backup complete. Files stored in: $BACKUP_PATH"
    # Create a symlink to the latest backup
    ln -sfn "$BACKUP_PATH" "${BACKUP_DIR}/latest"
}

restore() {
    local backup_path="$1"
    
    # If no path specified, use latest
    if [ -z "$backup_path" ]; then
        backup_path="${BACKUP_DIR}/latest"
        if [ ! -d "$backup_path" ]; then
            echo "No backup found to restore!"
            exit 1
        fi
    fi
    
    echo "Restoring configuration files from: $backup_path"
    
    # Stop affected services
    systemctl stop hostapd kea-dhcp4-server wifi-routing 2>/dev/null
    
    # Restore each file
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$backup_path$file" ]; then
            dir_path="$(dirname "$file")"
            mkdir -p "$dir_path"
            cp -p "$backup_path$file" "$file"
            echo "Restored: $file"
        fi
    done
    
    # Restart services
#    systemctl daemon-reload
#    systemctl restart networking
#    systemctl start hostapd kea-dhcp4-server wifi-routing
    
    echo "Restore complete. Please reboot the system for all changes to take effect."
}

list_backups() {
    echo "Available backups:"
    for backup in "$BACKUP_DIR"/*/; do
        if [ -d "$backup" ]; then
            timestamp=$(basename "$backup")
            if [ "$backup" -ef "${BACKUP_DIR}/latest" ]; then
                echo "  $timestamp (latest)"
            else
                echo "  $timestamp"
            fi
        fi
    done
}

case "$1" in
    backup)
        backup
        ;;
    restore)
        if [ -n "$2" ]; then
            restore "${BACKUP_DIR}/$2"
        else
            restore
        fi
        ;;
    list)
        list_backups
        ;;
    *)
        echo "Usage: $0 {backup|restore [timestamp]|list}"
        echo "  backup  - Create a new backup of configuration files"
        echo "  restore - Restore from latest backup or specified timestamp"
        echo "  list    - List available backups"
        exit 1
        ;;
esac 