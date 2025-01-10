#!/bin/bash
/usr/local/darkflows/installer/change_passwords.sh
/usr/local/darkflows/installer/change_variables.sh
/usr/local/darkflows/installer/install_packages.sh
/usr/local/darkflows/installer/secure_mysql.sh
/usr/local/darkflows/installer/create_kea_user.sh
/usr/local/darkflows/installer/install_pihole.sh
/usr/local/darkflows/installer/setup_web.sh
/usr/local/darkflows/bin/detect_network.sh
systemctl disable first-boot.service

