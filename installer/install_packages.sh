#!/bin/bash

# Set the environment to noninteractive to avoid prompts
export DEBIAN_FRONTEND=noninteractive

# Update the package list
# apt-get update

# Install the packages without prompting
# apt-get install -y nftables kea mariadb-server curl screen vlan irqbalance
apt -o Dpkg::Options::="--force-confold" --assume-yes install -y sudo unbound jq python3-pexpect python3-mysqldb openssh-server mariadb-server nodejs npm nftables kea curl screen vlan irqbalance ethtool samba iperf3 ca-certificates iftop

#activate
systemctl enable irqbalance --now

echo "Disabling X-Windows"
systemctl set-default multi-user.target
#sudo systemctl set-default graphical.target

systemctl disable --now unbound

# Notify the user
#echo "Packages installed successfully: nftables, kea, mariadb-server, curl, screen"
echo "irqbalance enabled"

