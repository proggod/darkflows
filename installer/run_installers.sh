#!/bin/bash

# Check if the script is running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: This script must be run as root. Please use 'sudo' or log in as the root user."
  exit 1
fi

# Determine if we're running on TTY1
current_tty=$(tty)
if [ "$current_tty" = "/dev/tty1" ]; then
    output_target="/var/log/installer.log"
else
    output_target="/dev/tty1 /var/log/installer.log"
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
/usr/local/darkflows/installer/change_passwords.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/change_variables.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/install_packages.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/secure_mysql.sh 2>&1 | tee -a $output_target
#/usr/local/darkflows/installer/install_pihole.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/setup_web.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/extract_configs.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/create_kea_user.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/setup_services.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/install_docker.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/setup_block_scheduler.sh 2>&1 | tee -a $output_target
/usr/local/darkflows/installer/update_ssh_key_location.sh 2>&1 | tee -a $output_target
echo "************ Detecting network... ************" | tee -a $output_target
if ! /usr/local/darkflows/installer/detect_network.sh 2>&1 | tee -a $output_target; then
    if [ -f /tmp/network_setup_status ] && [ "$(cat /tmp/network_setup_status)" == "NETWORK_SETUP_FAILED" ]; then
        echo "**********************************************************" | tee -a $output_target
        echo "ERROR: Network setup failed and could not be restored. Please configure networking manually." | tee -a $output_target
        echo "**********************************************************" | tee -a $output_target
        exit 1
    fi
fi
/usr/local/darkflows/installer/setup_vlan.sh 2>&1 | tee -a $output_target

# Add verification at end
echo "Running post-install verification..." | tee -a $output_target
/usr/local/darkflows/installer/verify_installation.sh 2>&1 | tee -a $output_target

/usr/local/darkflows/installer/rename_interfaces.sh 2>&1 | tee -a $output_target

systemctl disable first-boot.service 2>&1 | tee -a $output_target
echo "*****************************************************************" | tee -a $output_target
echo "====== Welcome to DarkFlows, your system is ready for use! ======" | tee -a $output_target
echo "*****************************************************************" | tee -a $output_target
echo "******* Please reboot your system to apply all changes. *********" | tee -a $output_target
echo "*****************************************************************" | tee -a $output_target

