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
# Drop existing database and user if they exist
DROP DATABASE IF EXISTS $DATABASE_NAME;
DROP USER IF EXISTS '$DB_USER'@'localhost';

# Create fresh database and user
CREATE DATABASE $DATABASE_NAME;
GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF

# Source network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network config"; exit 1; }

# Update Kea DHCP configuration file
KEA_CONF="/etc/kea/kea-dhcp4.conf"
sed -i "/\"lease-database\": {/,/}/ {
    s/\"name\": \".*\"/\"name\": \"$DATABASE_NAME\"/;
    s/\"user\": \".*\"/\"user\": \"$DB_USER\"/;
    s/\"password\": \".*\"/\"password\": \"$DB_PASSWORD\"/;
}" $KEA_CONF

#sed -i "/\"interfaces-config\": {/,/}/ {
#    /\"interfaces\": \[/,/\]/ s/\"enp2s0\"/\"$INTERNAL_INTERFACE\"/
#}" $KEA_CONF

# Replace the interface name in the Kea DHCP4 configuration file
sed -i "/\"interfaces-config\": {/,/}/ {
    /\"interfaces\": \[/,/\]/ {
        s/\"[^\"]*\"/\"$INTERNAL_INTERFACE\"/
    }
}" "$KEA_CONF"


sed -i '/^\[Unit\]/a After=mariadb.service\nRequires=mariadb.service' /usr/lib/systemd/system/kea-dhcp4-server.service

kea-admin db-init mysql -u kea -p $DB_PASSWORD -n kea

# Reload systemd configuration
systemctl daemon-reload

# Restart service
systemctl restart kea-dhcp4-server.service

echo "downloading mac address db"
python3 /usr/local/darkflows/installer/get_mac_name_db.py


# Notify the user
echo "MySQL database '$DATABASE_NAME' and user '$DB_USER' have been created."
echo "Updated Kea DHCP configuration at $KEA_CONF"
echo "Network interface set to: $INTERNAL_INTERFACE"
echo "Generated password: $DB_PASSWORD (save this somewhere secure)"

