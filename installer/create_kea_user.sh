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

# Execute MySQL commands
mysql -u root  <<EOF
CREATE DATABASE $DATABASE_NAME;
GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF

# Update Kea DHCP configuration file
KEA_CONF="/etc/kea/kea-dhcp4.conf"
sed -i "s|\"name\": \"kea\",|\"name\": \"$DATABASE_NAME\",|" $KEA_CONF
sed -i "s|\"user\": \"keadbuser\",|\"user\": \"$DB_USER\",|" $KEA_CONF
sed -i "s|\"password\": \"kea34fd\$3\",|\"password\": \"$DB_PASSWORD\",|" $KEA_CONF

# Notify the user
echo "MySQL database '$DATABASE_NAME' and user '$DB_USER' have been created."
echo "Updated Kea DHCP configuration at $KEA_CONF"
echo "Generated password: $DB_PASSWORD (save this somewhere secure)"

