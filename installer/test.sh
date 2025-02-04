#!/bin/bash

# Prompt to rename interfaces
echo "Do you want to rename network interfaces? This will require a reboot. (y/n)" | tee -a /dev/tty1 /var/log/installer.log
read -r RENAME_INTERFACES

if [[ "$RENAME_INTERFACES" =~ ^[Yy]$ ]]; then
    echo "Renaming network interfaces and rebooting..." | tee -a /dev/tty1 /var/log/installer.log
#    /usr/local/darkflows/installer/rename_interfaces.sh 2>&1 | tee -a /dev/tty1 /var/log/installer.log
    echo "Rebooting the system..." | tee -a /dev/tty1 /var/log/installer.log
#    reboot
else
    echo "Network interfaces were not renamed. It is recommended to run the renaming script later." | tee -a /dev/tty1 /var/log/installer.log
fi


