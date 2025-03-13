#!/bin/bash

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Use 'su -' to switch to the root user."
    exit 1
fi

# Database and user details
DATABASE_NAME="kea"
DB_USER="kea"
DB_PASSWORD=$(tr -dc 'A-Za-z' < /dev/urandom | head -c 12)

# Execute MySQL commands with cleanup
mysql -u root <<EOF
-- Drop existing database and user if they exist
DROP DATABASE IF EXISTS $DATABASE_NAME;
DROP USER IF EXISTS '$DB_USER'@'localhost';

-- Create fresh database and user
CREATE DATABASE $DATABASE_NAME;
GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF

# Source network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network config"; exit 1; }

# Update Kea DHCP configuration file for hosts-database
KEA_CONF="/etc/kea/kea-dhcp4.conf"
sed -i "/\"hosts-database\": {/,/}/ {
    s/\"name\": \".*\"/\"name\": \"$DATABASE_NAME\"/;
    s/\"user\": \".*\"/\"user\": \"$DB_USER\"/;
    s/\"password\": \".*\"/\"password\": \"$DB_PASSWORD\"/;
}" $KEA_CONF

# Update Kea DHCP configuration file for lease-database
sed -i "/\"lease-database\": {/,/}/ {
    s/\"name\": \".*\"/\"name\": \"$DATABASE_NAME\"/;
    s/\"user\": \".*\"/\"user\": \"$DB_USER\"/;
    s/\"password\": \".*\"/\"password\": \"$DB_PASSWORD\"/;
}" $KEA_CONF

# Update the interface if needed (assuming INTERNAL_INTERFACE is set in the sourced config)
if [ -n "$INTERNAL_INTERFACE" ]; then
    /usr/local/darkflows/installer/update-kea-interface.sh "$INTERNAL_INTERFACE"
fi

# Update the kea-dhcp4-server systemd service to require mariadb.service
sed -i '/^\[Unit\]/a After=mariadb.service\nRequires=mariadb.service' /usr/lib/systemd/system/kea-dhcp4-server.service

# Initialize the Kea database via kea-admin with correct argument spacing
kea-admin db-init mysql -u kea -p "$DB_PASSWORD" -n kea

# Reload systemd configuration
systemctl daemon-reload

# Restart Kea DHCPv4 service
systemctl restart kea-dhcp4-server.service

echo "Downloading MAC address database..."
python3 /usr/local/darkflows/installer/get_mac_name_db.py

# Notify the user
echo "MySQL database '$DATABASE_NAME' and user '$DB_USER' have been created."
echo "Updated Kea DHCP configuration at $KEA_CONF"
if [ -n "$INTERNAL_INTERFACE" ]; then
    echo "Network interface set to: $INTERNAL_INTERFACE"
fi
echo "Generated password: $DB_PASSWORD (save this somewhere secure)"


# Load the Kea schema into the database
#mysql -u root $DATABASE_NAME < /usr/share/kea/scripts/mysql/dhcpdb_create.mysql

