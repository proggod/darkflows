#!/bin/bash

# Ensure the script is run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Use 'su -' to switch to the root user."
  exit 1
fi

# Database and user details
DATABASE_NAME="kea"
DB_USER="keadbuser"
DB_PASSWORD="kea34fd$3"

# Execute MySQL commands
mysql -u root  <<EOF
CREATE DATABASE $DATABASE_NAME;
GRANT ALL PRIVILEGES ON $DATABASE_NAME.* TO '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF

# Notify the user
echo "MySQL database '$DATABASE_NAME' and user '$DB_USER' have been created."

