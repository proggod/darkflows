#!/usr/bin/env python3

import json
import os
import re
import sys
from pathlib import Path

INTERFACES_FILE = '/usr/local/darkflows/src/live-ifstat/scripts/interfaces'
VLANS_JSON = '/etc/darkflows/vlans.json'
KEA_CONFIG_PATH = '/usr/local/darkflows/src/live-ifstat/scripts/kea-dhcp4.conf'

def read_vlans_json():
    """Read and parse the VLANS configuration file."""
    try:
        with open(VLANS_JSON, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading VLANS configuration: {e}", file=sys.stderr)
        sys.exit(1)

def read_interfaces_file():
    """Read the network interfaces file."""
    try:
        with open(INTERFACES_FILE, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading interfaces file: {e}", file=sys.stderr)
        sys.exit(1)

def write_interfaces_file(content):
    """Write the updated network interfaces file."""
    try:
        # Create backup
        Path(INTERFACES_FILE).rename(f"{INTERFACES_FILE}.bak")
        
        # Write new content
        with open(INTERFACES_FILE, 'w') as f:
            f.write(content)
    except Exception as e:
        print(f"Error writing interfaces file: {e}", file=sys.stderr)
        # Restore backup if write failed
        try:
            Path(f"{INTERFACES_FILE}.bak").rename(INTERFACES_FILE)
        except:
            pass
        sys.exit(1)

def generate_vlan_config(vlan):
    """Generate interface configuration for a VLAN."""
    device_name = vlan['networkCard']['deviceName']  # This will be "2"
    vlan_id = vlan['id']
    gateway = vlan['gateway']
    netmask = vlan['subnet'].split('/')[1]
    
    # Convert CIDR to netmask
    netmask_bits = int(netmask)
    netmask = '.'.join([str((0xffffffff << (32 - netmask_bits) >> i) & 0xff)
                        for i in [24, 16, 8, 0]])
    
    return f"""
auto {device_name}.{vlan_id}
iface {device_name}.{vlan_id} inet static
    vlan-raw-device {device_name}
    address {gateway}
    netmask {netmask}"""

def update_interfaces():
    """Update the interfaces file with VLAN configurations."""
    # Read configurations
    vlans = read_vlans_json()
    interfaces_content = read_interfaces_file()
    
    # Remove existing VLAN configurations
    # Match any interface definition that includes 'vlan-raw-device'
    cleaned_content = re.sub(
        r'\nauto [^\n]+\niface [^\n]+\n\s+vlan-raw-device[^\n]+\n\s+address[^\n]+\n\s+netmask[^\n]+',
        '',
        interfaces_content
    )
    
    # Generate new VLAN configurations
    vlan_configs = [generate_vlan_config(vlan) for vlan in vlans]
    
    # Combine original content (without VLANs) and new VLAN configurations
    new_content = cleaned_content.rstrip() + '\n' + '\n'.join(vlan_configs) + '\n'
    
    # Write updated content
    write_interfaces_file(new_content)

def update_kea_dhcp_config():
    # Read the current VLANS configuration
    with open(VLANS_JSON, 'r') as f:
        vlans = json.load(f)

    # Read the current KEA config
    with open(KEA_CONFIG_PATH, 'r') as f:
        kea_config = json.load(f)

    # Keep track of the primary subnet (192.168.0.0/23)
    primary_subnet = None
    new_subnets = []

    # First, find and preserve the primary subnet
    for subnet in kea_config['Dhcp4']['subnet4']:
        if subnet['subnet'] == '192.168.0.0/23':
            primary_subnet = subnet
            new_subnets.append(subnet)
            break

    # Add subnet configurations for each VLAN
    for vlan in vlans:
        vlan_id = vlan['id']
        gateway = vlan.get('gateway')
        subnet_mask = vlan.get('subnet')
        
        if not gateway or not subnet_mask:
            print(f"Warning: Missing gateway or subnet for VLAN {vlan_id}", file=sys.stderr)
            continue

        # Clean up subnet mask - extract just the mask part (e.g. "24" from "192.168.20.1/24")
        if '/' in subnet_mask:
            subnet_mask = subnet_mask.split('/')[-1]

        # Construct network address from gateway and subnet
        network_parts = gateway.split('.')
        network_parts[-1] = '0'  # Replace last octet with 0
        
        # Format the network with cleaned subnet mask
        network = f"{'.'.join(network_parts)}/{subnet_mask}"
        
        # Extract the network prefix for pool configuration
        network_prefix = network_parts[0:3]
        
        subnet_config = {
            "id": 1000 + vlan_id,
            "subnet": network,
            "pools": [
                {
                    "pool": f"{'.'.join(network_prefix)}.10-{'.'.join(network_prefix)}.240"
                }
            ],
            "option-data": [
                {
                    "name": "routers",
                    "data": gateway
                },
                {
                    "name": "domain-name-servers",
                    "data": "192.168.1.1"
                }
            ]
        }
        new_subnets.append(subnet_config)

    # Update the config with new subnets
    kea_config['Dhcp4']['subnet4'] = new_subnets

    # Write the updated configuration
    with open(KEA_CONFIG_PATH, 'w') as f:
        json.dump(kea_config, f, indent=2)

    # Restart KEA DHCP service to apply changes
    #  os.system('systemctl restart kea-dhcp4-server')

def main():
    try:
        update_interfaces()
        update_kea_dhcp_config()
        print("Successfully updated network interfaces configuration")
    except Exception as e:
        print(f"Error updating network interfaces: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()