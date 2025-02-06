#!/bin/bash

# Check if the script is running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root. Please use 'sudo' or log in as the root user."
  exit 1
fi


# Add internet check at start
check_internet() {
    if ! ping -c 3 -W 5 8.8.8.8 &> /dev/null; then
        echo "ERROR: No internet connection detected! Installation cannot continue."
        echo "Check network cables and DHCP configuration, then try again."
        exit 1
    fi
}




# Run internet check first
check_internet

chmod a+x /usr/local/darkflows/installer/*.sh
echo "" > /var/log/installer.log
#/usr/local/darkflows/installer/change_passwords.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/change_variables.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/install_packages.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/secure_mysql.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/install_pihole.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/setup_web.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/extract_configs.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/detect_network.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/create_kea_user.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/setup_services.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/install_docker.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/setup_block_scheduler.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#/usr/local/darkflows/installer/update_ssh_key_location.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log

# Add verification at end
echo "Running post-install verification..." | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/verify_installation.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log


# Prompt to rename interfaces
#echo "We recommend to rename network interfaces, OK? This will require a reboot. (y/n)" | tee -a /dev/tty1 /var/log/installer.log
#read -r RENAME_INTERFACES
#
#if [[ "$RENAME_INTERFACES" =~ ^[Yy]$ ]]; then
#    echo "Renaming network interfaces and rebooting..." | tee -a /dev/tty1 /var/log/installer.log
#    /usr/local/darkflows/installer/rename_interfaces.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
#    echo "Rebooting the system..." | tee -a /dev/tty1 /var/log/installer.log
#    reboot
#else
#    echo "Network interfaces were not renamed. It is recommended to run the renaming script later." | tee -a /dev/tty1 /var/log/installer.log
#fi



#systemctl disable first-boot.service 2>&1 | tee -a /dev/tty1 /var/log/installer.log
echo "=========== Welcome to DarkFlows, your system is ready for use! =========="

