#!/bin/bash

# Set the root password for MariaDB/MySQL
ROOT_PASSWORD="darkflows"

# Pre-configure the root password using debconf
echo "mariadb-server mysql-server/root_password password $ROOT_PASSWORD" | debconf-set-selections
echo "mariadb-server mysql-server/root_password_again password $ROOT_PASSWORD" | debconf-set-selections

# Install MariaDB server without prompting
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -o Dpkg::Options::="--force-confold" --assume-yes install -y mariadb-server python3-mysqldb

# Automate the mysql_secure_installation steps
mysql -uroot -p"$ROOT_PASSWORD" <<EOF
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF

# Notify the user
echo "MariaDB/MySQL has been secured automatically."

