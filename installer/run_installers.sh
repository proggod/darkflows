#!/bin/bash
chmod a+x /usr/local/darkflows/installer/*.sh
echo "" > /var/log/installer.log
/usr/local/darkflows/installer/change_passwords.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/change_variables.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/install_packages.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/secure_mysql.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/install_pihole.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/setup_web.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/extract_configs.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/detect_network.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/create_kea_user.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/setup_services.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/install_docker.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/setup_block_scheduler.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/update_ssh_key_location.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log

systemctl disable first-boot.service 2>&1 | tee -a /dev/tty1 /var/log/installer.log
echo "=========== Welcome to DarkFlows, your system is ready for use! =========="

