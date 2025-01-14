#!/bin/bash

# Set the environment to noninteractive to avoid prompts
export DEBIAN_FRONTEND=noninteractive

# Update the package list
# apt-get update

# Install the packages without prompting
# apt-get install -y nftables kea mariadb-server curl screen vlan irqbalance

#activate
systemctl enable irqbalance --now

# Notify the user
#echo "Packages installed successfully: nftables, kea, mariadb-server, curl, screen"
echo "irqbalance enabled"

