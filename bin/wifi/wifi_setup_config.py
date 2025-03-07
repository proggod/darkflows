#!/usr/bin/env python3
"""
WiFi Setup Script for Darkflows Debian Router - Part 3 (Configuration Module)
This module handles configuring network interfaces, hostapd, and other services
"""

import os
import re
import json
import shutil
import sys
import subprocess
from pathlib import Path

def run_command(command, check=True):
    """Run a shell command and return the output"""
    try:
        result = subprocess.run(command, shell=True, check=check, 
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        print(f"Error message: {e.stderr}")
        if check:
            sys.exit(1)
        return "", e.stderr, e.returncode

def backup_file(file_path):
    """Create a backup of a file"""
    import time
    if os.path.exists(file_path):
        backup_path = f"{file_path}.bak.{int(time.time())}"
        shutil.copy2(file_path, backup_path)
        print(f"Created backup: {backup_path}")
        return backup_path
    return None

def update_interfaces_file(internal_interface, wifi_device, bridge_name, network_config):
    """Update /etc/network/interfaces to set up bridge"""
    interfaces_path = "/etc/network/interfaces"
    backup_file(interfaces_path)
    
    # Read current file content to preserve any custom settings
    with open(interfaces_path, 'r') as f:
        content = f.readlines()
    
    # Find and comment out any existing interface configurations
    new_content = []
    i = 0
    while i < len(content):
        line = content[i]
        
        # If we find any configuration for our interfaces, skip it
        if any(pattern in line for pattern in [
            f"auto {internal_interface}",
            f"allow-hotplug {internal_interface}",
            f"iface {internal_interface}",
            f"auto {wifi_device}",
            f"allow-hotplug {wifi_device}",
            f"iface {wifi_device}",
            f"auto {bridge_name}",
            f"allow-hotplug {bridge_name}",
            f"iface {bridge_name}"
        ]):
            # Skip this line and any indented lines that follow
            i += 1
            while i < len(content) and (not content[i].strip() or content[i].startswith(" ") or content[i].startswith("\t")):
                i += 1
            continue
        
        new_content.append(line)
        i += 1
    
    # Add bridge configuration
    bridge_config = f"""
# Bridge interface configuration
auto {bridge_name}
iface {bridge_name} inet static
    bridge_ports {internal_interface} {wifi_device}
    address {network_config['ip_address']}
    netmask {network_config['netmask']}
    bridge_stp off
    bridge_fd 0
    bridge_maxwait 0
"""
    
    with open(interfaces_path, 'w') as f:
        f.writelines(new_content)
        f.write(bridge_config)
    
    print(f"Updated {interfaces_path}")

def setup_hostapd(wifi_device, ssid, password, hw_mode, channel, bridge_name, wifi_capabilities):
    """Install and configure hostapd"""
    # Install required packages
    print("Installing required packages...")
    run_command("apt update")
    run_command("apt install -y hostapd bridge-utils iw wireless-tools")
    
    # Enable and unmask hostapd service
    run_command("systemctl unmask hostapd")
    run_command("systemctl enable hostapd")
    
    # Create hostapd configuration
    hostapd_conf_path = "/etc/hostapd/hostapd.conf"
    backup_file(hostapd_conf_path)
    
    # Get country code or default to US
    stdout, stderr, retcode = run_command("iw reg get | grep 'country' | head -1 | awk '{print $2}'", check=False)
    country_code = stdout.strip() if retcode == 0 and stdout.strip() else "US"
    
    # Basic configuration
    hostapd_config = f"""interface={wifi_device}
driver=nl80211
bridge={bridge_name}
ssid={ssid}
hw_mode={hw_mode}
channel={channel}
country_code={country_code}
ieee80211d=1
"""

    # Add WPA configuration
    hostapd_config += f"""
# Security settings
auth_algs=1
wpa=2
wpa_passphrase={password}
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
"""

    # Add advanced features based on capabilities
    if wifi_capabilities['supports_80211n']:
        hostapd_config += f"""
# 802.11n support
ieee80211n=1
"""
        # Add HT capabilites for 40MHz channels if using 5GHz (less congested)
        if hw_mode == 'a':  # 5GHz
            hostapd_config += f"""ht_capab=[HT40+][SHORT-GI-20][SHORT-GI-40][DSSS_CCK-40]
"""

    # Add 802.11ac support if available and using 5GHz
    if wifi_capabilities['supports_80211ac'] and hw_mode == 'a':
        hostapd_config += f"""
# 802.11ac support
ieee80211ac=1
vht_oper_chwidth=1
vht_oper_centr_freq_seg0_idx={int(channel) + 6}
vht_capab=[MAX-MPDU-11454][SHORT-GI-80]
"""

    # Add WMM (QoS) support
    hostapd_config += f"""
# QoS support
wmm_enabled=1
"""

    # Add VLAN configuration
    hostapd_config += f"""
# VLAN configuration
vlan_file=/etc/hostapd/hostapd.vlan
vlan_bridge={bridge_name}
"""
    
    # Ensure the directory exists
    os.makedirs(os.path.dirname(hostapd_conf_path), exist_ok=True)
    
    with open(hostapd_conf_path, 'w') as f:
        f.write(hostapd_config)
    
    # Create empty hostapd.vlan file if it doesn't exist
    vlan_file_path = "/etc/hostapd/hostapd.vlan"
    if not os.path.exists(vlan_file_path):
        with open(vlan_file_path, 'w') as f:
            f.write("# VLAN configurations will go here\n")
    
    # Configure hostapd daemon
    daemon_conf_path = "/etc/default/hostapd"
    backup_file(daemon_conf_path)
    
    with open(daemon_conf_path, 'r') as f:
        daemon_conf = f.read()
    
    # Set DAEMON_CONF to point to our config file
    if 'DAEMON_CONF=' in daemon_conf:
        daemon_conf = re.sub(r'#?DAEMON_CONF=.*', f'DAEMON_CONF="{hostapd_conf_path}"', daemon_conf)
    else:
        daemon_conf += f'\nDAEMON_CONF="{hostapd_conf_path}"\n'
    
    with open(daemon_conf_path, 'w') as f:
        f.write(daemon_conf)
    
    print(f"Configured hostapd in {hostapd_conf_path}")

def update_darkflows_config(bridge_name):
    """Update Darkflows configuration to use the bridge for internal interface"""
    darkflows_config_path = "/etc/darkflows/d_network.cfg"
    backup_file(darkflows_config_path)
    
    with open(darkflows_config_path, 'r') as f:
        content = f.read()
    
    # Replace INTERNAL_INTERFACE with bridge
    updated_content = re.sub(
        r'INTERNAL_INTERFACE="([^"]+)"', 
        f'INTERNAL_INTERFACE="{bridge_name}"', 
        content
    )
    
    with open(darkflows_config_path, 'w') as f:
        f.write(updated_content)
    
    print(f"Updated Darkflows config to use {bridge_name} as internal interface")

def update_kea_config(bridge_name, internal_interface):
    """Update Kea DHCP server configuration to use the bridge interface"""
    kea_conf_path = "/etc/kea/kea-dhcp4.conf"
    
    if not os.path.exists(kea_conf_path):
        print(f"Warning: Kea DHCP configuration not found at {kea_conf_path}. Skipping.")
        return
    
    backup_file(kea_conf_path)
    
    with open(kea_conf_path, 'r') as f:
        content = f.read()
    
    # Parse as JSON
    try:
        kea_config = json.loads(content)
        
        # Update the interfaces list if it exists
        if 'Dhcp4' in kea_config and 'interfaces-config' in kea_config['Dhcp4'] and 'interfaces' in kea_config['Dhcp4']['interfaces-config']:
            interfaces_list = kea_config['Dhcp4']['interfaces-config']['interfaces']
            
            # Remove the old internal interface if it exists
            if internal_interface in interfaces_list:
                interfaces_list.remove(internal_interface)
                print(f"Removed {internal_interface} from Kea DHCP interfaces configuration")
            
            # Add the bridge interface if it's not already there
            if bridge_name not in interfaces_list:
                interfaces_list.append(bridge_name)
                kea_config['Dhcp4']['interfaces-config']['interfaces'] = interfaces_list
                
                # Write the updated config
                with open(kea_conf_path, 'w') as f:
                    json.dump(kea_config, f, indent=2)
                
                print(f"Added {bridge_name} to Kea DHCP interfaces configuration")
            else:
                print(f"{bridge_name} already in Kea DHCP interfaces configuration")
        else:
            print("Warning: Could not find interfaces configuration in Kea config")
    except json.JSONDecodeError:
        print(f"Warning: Could not parse Kea config file as JSON. Manual update may be required.")

def enable_ipv4_forwarding():
    """Enable IP forwarding for routing"""
    sysctl_path = "/etc/sysctl.conf"
    
    with open(sysctl_path, 'r') as f:
        content = f.read()
    
    if "net.ipv4.ip_forward=1" not in content:
        with open(sysctl_path, 'a') as f:
            f.write("\n# Enable IP forwarding for WiFi AP\nnet.ipv4.ip_forward=1\n")
        
        # Apply the change immediately
        run_command("sysctl -p")
        print("Enabled IPv4 forwarding")

def configure_firewall(bridge_name):
    """Configure firewall for masquerading"""
    # Check if we're using nftables
    stdout, stderr, retcode = run_command("which nft", check=False)
    if retcode == 0:
        # Ensure NAT table exists
        stdout, stderr, retcode = run_command("nft list table ip nat", check=False)
        if retcode != 0:
            # Create NAT table and chains if they don't exist
            run_command("nft add table ip nat")
            run_command("nft add chain ip nat prerouting { type nat hook prerouting priority -100 \\; }")
            run_command("nft add chain ip nat postrouting { type nat hook postrouting priority 100 \\; }")
        
        # Add masquerade rule for the bridge
        check_rule_cmd = f"nft list ruleset | grep 'oif \"{bridge_name}\" masquerade'"
        stdout, stderr, retcode = run_command(check_rule_cmd, check=False)
        
        if retcode != 0:  # Rule doesn't exist
            add_rule_cmd = f"nft add rule ip nat postrouting oif \"{bridge_name}\" masquerade"
            run_command(add_rule_cmd)
            print(f"Added masquerade rule for {bridge_name}")
    else:
        # Check if we're using iptables
        stdout, stderr, retcode = run_command("which iptables", check=False)
        if retcode == 0:
            check_rule_cmd = f"iptables -t nat -C POSTROUTING -o {bridge_name} -j MASQUERADE"
            stdout, stderr, retcode = run_command(check_rule_cmd, check=False)
            
            if retcode != 0:  # Rule doesn't exist
                add_rule_cmd = f"iptables -t nat -A POSTROUTING -o {bridge_name} -j MASQUERADE"
                run_command(add_rule_cmd)
                print(f"Added masquerade rule for {bridge_name}")
        else:
            print("Warning: Neither nft nor iptables found. Skipping firewall configuration.")

def create_boot_script(bridge_name):
    """Create a boot script for routing and firewall setup"""
    script_path = "/usr/local/darkflows/bin/wifi-routing.sh"
    
    script_content = f"""#!/bin/bash
# Wifi Routing Setup Script for Darkflows
# This script sets up routing and firewall rules for the WiFi bridge interface
# Created by the wifi_setup.py script

# Check if WiFi has been set up by looking for hostapd configuration
if [ ! -f /etc/hostapd/hostapd.conf ]; then
  echo "WiFi not configured (no hostapd.conf found). Exiting."
  exit 0
fi

# Check if hostapd service is enabled
if ! systemctl is-enabled hostapd >/dev/null 2>&1; then
  echo "Hostapd service not enabled. Exiting."
  exit 0
fi

# Source the network configuration
source /etc/darkflows/d_network.cfg || {{ echo "Failed to source network configuration"; exit 1; }}

# Check if the bridge interface is defined in the network config
if ! grep -q "bridge_ports" /etc/network/interfaces; then
  echo "No bridge configuration found in network interfaces. Exiting."
  exit 0
fi

# Make sure IP forwarding is enabled
sysctl -w net.ipv4.ip_forward=1

# Get the bridge interface from Darkflows config if not provided as argument
if [ -z "$1" ]; then
    # Extract the bridge name from the internal interface in d_network.cfg
    BRIDGE_NAME="$INTERNAL_INTERFACE"
    echo "Using bridge from d_network.cfg: $BRIDGE_NAME"
else
    BRIDGE_NAME="$1"
    echo "Using bridge from command line: $BRIDGE_NAME"
fi

# Wait for the bridge interface to be available
COUNTER=0
while [ $COUNTER -lt 30 ]; do
  if ip link show $BRIDGE_NAME >/dev/null 2>&1; then
    echo "Bridge $BRIDGE_NAME is available"
    break
  fi
  echo "Waiting for bridge $BRIDGE_NAME to become available..."
  sleep 1
  COUNTER=$((COUNTER + 1))
done

if ! ip link show $BRIDGE_NAME >/dev/null 2>&1; then
  echo "ERROR: Bridge $BRIDGE_NAME not found after waiting"
  exit 1
fi

# Ensure bridge is up
ip link set $BRIDGE_NAME up

# Add masquerade rule for the bridge if it doesn't exist
if ! nft list ruleset | grep -q "oif \\"$BRIDGE_NAME\\" masquerade"; then
    if nft list table ip nat > /dev/null 2>&1; then
        nft add rule ip nat postrouting oif "$BRIDGE_NAME" masquerade
        echo "Added masquerade rule for $BRIDGE_NAME"
    fi
fi

# Allow forwarding from bridge to WAN interfaces
if nft list table inet filter > /dev/null 2>&1; then
    # Add rules if they don't exist
    if ! nft list ruleset | grep -q "iif $BRIDGE_NAME oif \\"$PRIMARY_INTERFACE\\" accept"; then
        nft add rule inet filter forward iif $BRIDGE_NAME oif $PRIMARY_INTERFACE accept
        echo "Added forwarding rule from $BRIDGE_NAME to $PRIMARY_INTERFACE"
    fi
    
    if ! nft list ruleset | grep -q "iif \\"$PRIMARY_INTERFACE\\" oif $BRIDGE_NAME ct state"; then
        nft add rule inet filter forward iif $PRIMARY_INTERFACE oif $BRIDGE_NAME ct state established,related accept
        echo "Added return traffic forwarding rule from $PRIMARY_INTERFACE to $BRIDGE_NAME"
    fi
    
    # If secondary interface is defined, add rules for it too
    if [ -n "$SECONDARY_INTERFACE" ]; then
        if ! nft list ruleset | grep -q "iif $BRIDGE_NAME oif \\"$SECONDARY_INTERFACE\\" accept"; then
            nft add rule inet filter forward iif $BRIDGE_NAME oif $SECONDARY_INTERFACE accept
            echo "Added forwarding rule from $BRIDGE_NAME to $SECONDARY_INTERFACE"
        fi
        
        if ! nft list ruleset | grep -q "iif \\"$SECONDARY_INTERFACE\\" oif $BRIDGE_NAME ct state"; then
            nft add rule inet filter forward iif $SECONDARY_INTERFACE oif $BRIDGE_NAME ct state established,related accept
            echo "Added return traffic forwarding rule from $SECONDARY_INTERFACE to $BRIDGE_NAME"
        fi
    fi
    
    # Allow input from bridge
    if ! nft list ruleset | grep -q "iif \\"$BRIDGE_NAME\\" accept"; then
        nft add rule inet filter input iif $BRIDGE_NAME accept
        echo "Added input acceptance rule for $BRIDGE_NAME"
    fi
fi

echo "WiFi routing setup complete"
"""
    
    # Ensure the directory exists
    os.makedirs(os.path.dirname(script_path), exist_ok=True)
    
    with open(script_path, 'w') as f:
        f.write(script_content)
    
    # Make the script executable
    os.chmod(script_path, 0o755)
    
    print(f"Created wifi-routing boot script at {script_path}")


