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
/usr/bin/python3 /usr/local/darkflows/bin/verify_configs.py
/usr/local/darkflows/installer/install_packages.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/setup_web.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/install_speedtest.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
/usr/bin/python3 /usr/local/darkflows/installer/setup_crontab.py 2>&1 | tee -a $output_target

# Add verification at end
echo "Running post-install verification..." | tee -a /dev/tty1 /var/log/installer.log
/usr/local/darkflows/installer/verify_installation.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log


echo "=========== Welcome to DarkFlows, your system is ready for use! =========="

