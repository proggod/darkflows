#!/usr/bin/env python3
"""
WiFi Setup Script for Darkflows Debian Router

This script automates the process of setting up a WiFi access point on a Debian router
with Darkflows installed.

Usage: sudo python3 wifi_setup.py --ssid ACCESS_POINT_NAME --password WIFI_PASSWORD
"""

import argparse
import os
import re
import subprocess
import sys
import shutil
import time
import json
import ipaddress
from pathlib import Path

# Default values
DEFAULT_CHANNEL_2G = "6"
DEFAULT_CHANNEL_5G = "36"
DEFAULT_BRIDGE_NAME = "br0"

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

def is_root():
    """Check if the script is running as root"""
    return os.geteuid() == 0

def get_internal_interface():
    """Extract internal interface from /etc/darkflows/d_network.cfg"""
    config_path = "/etc/darkflows/d_network.cfg"
    
    if not os.path.exists(config_path):
        print(f"Error: {config_path} does not exist. Is Darkflows installed?")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        content = f.read()
    
    match = re.search(r'INTERNAL_INTERFACE="([^"]+)"', content)
    if match:
        return match.group(1)
    else:
        print("Error: Could not find INTERNAL_INTERFACE in config file")
        sys.exit(1)

def backup_file(file_path):
    """Create a backup of a file"""
    if os.path.exists(file_path):
        backup_path = f"{file_path}.bak.{int(time.time())}"
        shutil.copy2(file_path, backup_path)
        print(f"Created backup: {backup_path}")
        return backup_path
    return None

def get_network_config():
    """Detect network configuration from system files"""
    result = {
        'ip_address': None,
        'netmask': None,
        'subnet_cidr': None,
        'gateway': None,
        'network_address': None
    }
    
    # Try to get from /etc/network/interfaces first
    interfaces_path = "/etc/network/interfaces"
    internal_interface = get_internal_interface()
    
    if os.path.exists(interfaces_path):
        with open(interfaces_path, 'r') as f:
            content = f.read()
            
        # Look for internal interface configuration
        iface_match = re.search(rf"iface\s+{internal_interface}\s+inet\s+static[^\n]*\n((?:\s+[^\n]+\n)+)", content)
        if iface_match:
            iface_config = iface_match.group(1)
            
            # Extract IP address
            ip_match = re.search(r"address\s+([0-9.]+)", iface_config)
            if ip_match:
                result['ip_address'] = ip_match.group(1)
                
            # Extract netmask
            netmask_match = re.search(r"netmask\s+([0-9.]+)", iface_config)
            if netmask_match:
                result['netmask'] = netmask_match.group(1)
                
            # If we have both IP and netmask, calculate the subnet CIDR
            if result['ip_address'] and result['netmask']:
                try:
                    # Convert netmask to CIDR format
                    netmask_bits = sum([bin(int(x)).count('1') for x in result['netmask'].split('.')])
                    result['subnet_cidr'] = f"{result['ip_address']}/{netmask_bits}"
                    
                    # Calculate network address
                    ip_obj = ipaddress.IPv4Interface(result['subnet_cidr'])
                    result['network_address'] = str(ip_obj.network.network_address)
                except Exception as e:
                    print(f"Warning: Error calculating subnet CIDR: {e}")
    
    # If we couldn't get from interfaces, try Kea DHCP config
    if not result['ip_address'] or not result['netmask']:
        kea_conf_path = "/etc/kea/kea-dhcp4.conf"
        if os.path.exists(kea_conf_path):
            try:
                with open(kea_conf_path, 'r') as f:
                    kea_config = json.load(f)
                
                # Find the subnet that matches our internal interface
                if 'Dhcp4' in kea_config and 'subnet4' in kea_config['Dhcp4']:
                    subnets = kea_config['Dhcp4']['subnet4']
                    for subnet in subnets:
                        if 'subnet' in subnet:
                            # Check if this is the primary subnet (usually ID 1)
                            if subnet.get('id') == 1:
                                result['subnet_cidr'] = subnet['subnet']
                                
                                # Extract network and prefix length
                                network, prefix = result['subnet_cidr'].split('/')
                                result['network_address'] = network
                                
                                # Find router (gateway) option
                                if 'option-data' in subnet:
                                    for option in subnet['option-data']:
                                        if option.get('name') == 'routers':
                                            result['gateway'] = option.get('data')
                                            break
                                
                                # Convert CIDR to netmask if needed
                                if not result['netmask']:
                                    try:
                                        ip_obj = ipaddress.IPv4Network(result['subnet_cidr'])
                                        result['netmask'] = str(ip_obj.netmask)
                                    except Exception as e:
                                        print(f"Warning: Error converting CIDR to netmask: {e}")
                                
                                # If we have a gateway but no IP, use gateway with last octet set to 1
                                if result['gateway'] and not result['ip_address']:
                                    gateway_parts = result['gateway'].split('.')
                                    if len(gateway_parts) == 4:
                                        gateway_parts[-1] = '1'  # Set last octet to 1
                                        result['ip_address'] = '.'.join(gateway_parts)
                                
                                break
            except Exception as e:
                print(f"Warning: Error parsing Kea config: {e}")
    
    # If we still don't have all the information, use defaults
    if not result['ip_address'] or not result['netmask']:
        print("Warning: Could not detect network configuration. Using defaults.")
        result['ip_address'] = "192.168.1.1"
        result['netmask'] = "255.255.255.0"
        result['subnet_cidr'] = "192.168.1.0/24"
        result['network_address'] = "192.168.1.0"
    
    if not result['gateway']:
        result['gateway'] = result['ip_address']  # Use IP as gateway if not specified
    
    print(f"Detected network configuration:")
    print(f"  IP Address: {result['ip_address']}")
    print(f"  Netmask: {result['netmask']}")
    print(f"  Subnet CIDR: {result['subnet_cidr']}")
    print(f"  Gateway: {result['gateway']}")
    print(f"  Network Address: {result['network_address']}")
    
    return result

# Import helper modules
from wifi_setup_wifi import detect_wifi_capabilities, find_available_wifi_devices
from wifi_setup_wifi import find_available_bridge_name, select_random_channel, verify_wifi_device
from wifi_setup_config import update_interfaces_file, setup_hostapd, update_darkflows_config
from wifi_setup_config import update_kea_config, enable_ipv4_forwarding, configure_firewall
from wifi_setup_config import create_boot_script

def main():
    parser = argparse.ArgumentParser(description="Set up WiFi AP on Darkflows Debian Router")
    parser.add_argument("--wifi-device", help="WiFi device name (e.g., wlan0) - will be auto-detected if not specified")
    parser.add_argument("--ssid", required=True, help="WiFi network name")
    parser.add_argument("--password", required=True, help="WiFi password (min 8 characters)")
    parser.add_argument("--channel", help="WiFi channel (e.g., 6 for 2.4GHz, 36 for 5GHz) - will be chosen randomly if not specified")
    parser.add_argument("--band", choices=["2.4", "5", "auto"], default="auto", help="WiFi band (2.4, 5 GHz, or auto)")
    parser.add_argument("--bridge", help=f"Bridge interface name (default: first available br0, br1, etc.)")
    
    args = parser.parse_args()
    
    # Validate inputs
    if not is_root():
        print("Error: This script must be run as root (sudo)")
        sys.exit(1)
    
    if len(args.password) < 8:
        print("Error: WiFi password must be at least 8 characters")
        sys.exit(1)
    
    # Find available WiFi devices if not specified
    if not args.wifi_device:
        print("No WiFi device specified, searching for available devices...")
        available_devices = find_available_wifi_devices()
        
        if not available_devices:
            print("Error: No WiFi devices with AP mode support found!")
            print("Please connect a compatible WiFi adapter or specify the device manually.")
            sys.exit(1)
        
        args.wifi_device = available_devices[0]
        print(f"Found WiFi device: {args.wifi_device}")
    
    # Find available bridge name if not specified
    if not args.bridge:
        args.bridge = find_available_bridge_name()
        print(f"Using bridge interface: {args.bridge}")
    
    # Check WiFi device and capabilities
    wifi_capabilities = verify_wifi_device(args.wifi_device)
    
    # Determine which band to use
    if args.band == "5" and not wifi_capabilities['supports_5ghz']:
        print("WARNING: 5GHz band requested but device does not support it. Falling back to 2.4GHz.")
        band = "2.4"
    elif args.band == "5":
        band = "5"
    elif args.band == "2.4":
        band = "2.4"
    elif args.band == "auto" and wifi_capabilities['supports_5ghz']:
        print("5GHz band supported! Using 5GHz for better performance.")
        band = "5"
    else:
        print("Using 2.4GHz band.")
        band = "2.4"
    
    # Set hardware mode and channel based on band
    if band == "5":
        hw_mode = "a"  # 'a' is used for 5GHz
        channel = args.channel if args.channel else select_random_channel("5")
    else:
        hw_mode = "g"  # 'g' is used for 2.4GHz
        channel = args.channel if args.channel else select_random_channel("2.4")
    
    print(f"Setting up WiFi AP with device {args.wifi_device}, SSID: {args.ssid}, Band: {band}GHz, Channel: {channel}")
    
    # Get internal interface from Darkflows config
    internal_interface = get_internal_interface()
    print(f"Found internal interface: {internal_interface}")
    
    # Get network configuration
    network_config = get_network_config()
    
    # Create backup of all configuration files
    print("\nCreating backup of existing configuration...")
    run_command("bash ./wifi_backup_restore.sh backup")
    
    # Enable IPv4 forwarding
    enable_ipv4_forwarding()
    
    # Update interfaces file
    update_interfaces_file(internal_interface, args.wifi_device, args.bridge, network_config)
    
    # Set up hostapd
    setup_hostapd(args.wifi_device, args.ssid, args.password, hw_mode, channel, args.bridge, wifi_capabilities)
    
    # Update Darkflows config to use the bridge
    update_darkflows_config(args.bridge)
    
    # Update Kea DHCP configuration
    update_kea_config(args.bridge, internal_interface)
    
    # Create and configure bridge interface
    print("Creating bridge interface...")
    run_command("brctl addbr " + args.bridge, check=False)  # Create bridge (ignore if exists)
    
    print("\nSetup complete! Reboot the system for all changes to take effect.")
    print(f"After reboot, your WiFi network '{args.ssid}' should be available.")
    print("If the WiFi doesn't work, check the following:")
    print("  - 'systemctl status hostapd' for hostapd errors")
    print("  - 'systemctl status wifi-routing' for routing issues")
    print("  - 'ip link show' to verify bridge interface is up")
    print("  - 'brctl show' to verify bridge connections")
    print(f"\nNetwork Details:")
    print(f"  - SSID: {args.ssid}")
    print(f"  - Band: {band}GHz")
    print(f"  - Channel: {channel}")
    print(f"  - Bridge: {args.bridge}")
    print(f"  - IP Address: {network_config['ip_address']}")
    print(f"  - Netmask: {network_config['netmask']}")

if __name__ == "__main__":
    main()

