#!/usr/bin/env python3

import json
import os
import re
import sys
from pathlib import Path

INTERFACES_FILE = '/etc/network/interfaces'
VLANS_JSON = '/etc/darkflows/vlans.json'
KEA_CONFIG_PATH = '/etc/kea/kea-dhcp4.conf'
DARKFLOWS_CONFIG = '/etc/darkflows/d_network.cfg'

def parse_darkflows_config():
    """
    Parse /etc/darkflows/d_network.cfg to retrieve the interface variables.
    For example: PRIMARY_INTERFACE=lan1, INTERNAL_INTERFACE=lan0, etc.
    """
    config_map = {}
    if not os.path.exists(DARKFLOWS_CONFIG):
        return config_map

    with open(DARKFLOWS_CONFIG, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            # Example line: PRIMARY_INTERFACE="lan1"
            if '=' in line:
                key, val = line.split('=', 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")  # remove quotes
                config_map[key] = val
    return config_map

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
    """Write the updated network interfaces file, creating a backup."""
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

def generate_vlan_config(vlan, darkflows_map):
    """
    Generate interface configuration for a VLAN.
    We'll look up the real base interface name from label (e.g. "Internal" => lan0).
    Then we add egress/ingress/cakeParams as comments or optional 'up' commands.
    """
    label = vlan['networkCard'].get('label', '').lower()  # e.g. "internal"
    
    # Map label -> darkflows config key
    label_map = {
        "internal":  "INTERNAL_INTERFACE",
        "primary":   "PRIMARY_INTERFACE",
        "secondary": "SECONDARY_INTERFACE",
        # Add more if needed
    }
    if label in label_map:
        config_key = label_map[label]
        device_name = darkflows_map.get(config_key, "lan0")  # fallback
    else:
        # Fallback to deviceName if label not recognized
        device_name = vlan['networkCard'].get('deviceName', 'lan0')

    vlan_id = vlan['id']
    gateway = vlan['gateway']
    netmask_bits = vlan['subnet'].split('/')[1]
    
    # Convert CIDR to netmask
    netmask_bits = int(netmask_bits)
    netmask = '.'.join([
        str((0xffffffff << (32 - netmask_bits) >> i) & 0xff)
        for i in [24, 16, 8, 0]
    ])

    # Pull shaping fields from JSON (optional)
    egress_bw = vlan.get("egressBandwidth", "N/A")
    ingress_bw = vlan.get("ingressBandwidth", "N/A")
    cake_params = vlan.get("cakeParams", "")

    # If you want these as comment lines only:
    return f"""
auto {device_name}.{vlan_id}
iface {device_name}.{vlan_id} inet static
    vlan-raw-device {device_name}
    address {gateway}
    netmask {netmask}

"""

def update_interfaces():
    """Update the interfaces file with VLAN configurations."""
    darkflows_map = parse_darkflows_config()

    vlans = read_vlans_json()
    interfaces_content = read_interfaces_file()
    
    # Remove existing VLAN configs that match 'vlan-raw-device ... address ... netmask'
    cleaned_content = re.sub(
        r'\nauto [^\n]+\niface [^\n]+\n\s+vlan-raw-device[^\n]+\n\s+address[^\n]+\n\s+netmask[^\n]+(\n\s+.*?)*',
        '',
        interfaces_content
    )

    # Generate new VLAN stanzas
    vlan_configs = [generate_vlan_config(vlan, darkflows_map) for vlan in vlans]
    
    # Combine original content (minus old VLANs) + new VLAN stanzas
    new_content = cleaned_content.rstrip() + '\n' + '\n'.join(vlan_configs) + '\n'
    
    # Write updated file
    write_interfaces_file(new_content)

def update_kea_dhcp_config():
    """Update Kea DHCP configuration with VLAN subnets."""
    vlans = read_vlans_json()
    darkflows_map = parse_darkflows_config()

    with open(KEA_CONFIG_PATH, 'r') as f:
        kea_config = json.load(f)

    # Keep track of the primary subnet (192.168.0.0/23)
    primary_subnet = None
    new_subnets = []

    # Find & preserve the primary subnet
    for subnet in kea_config['Dhcp4']['subnet4']:
        if subnet['subnet'] == '192.168.0.0/23':
            primary_subnet = subnet
            new_subnets.append(subnet)
            break

    # Existing VLAN subnets
    existing_vlans = {
        subnet['subnet']: subnet
        for subnet in kea_config['Dhcp4']['subnet4']
        if subnet['subnet'] != '192.168.0.0/23'
    }

    # Add or update subnets for each VLAN
    for vlan in vlans:
        vlan_id = vlan['id']
        gateway = vlan.get('gateway')
        subnet_mask = vlan.get('subnet')
        
        if not gateway or not subnet_mask:
            print(f"Warning: Missing gateway or subnet for VLAN {vlan_id}", file=sys.stderr)
            continue

        # Extract numeric mask from e.g. "192.168.20.1/24"
        if '/' in subnet_mask:
            subnet_mask = subnet_mask.split('/')[-1]

        # Construct network address from gateway and subnet
        network_parts = gateway.split('.')
        network_parts[-1] = '0'  # Replace last octet with 0
        network = f"{'.'.join(network_parts)}/{subnet_mask}"

        # example: 192.168.20.0/24 => 192.168.20.10 - 192.168.20.240
        network_prefix = network_parts[0:3]
        pool_start = f"{'.'.join(network_prefix)}.10"
        pool_end   = f"{'.'.join(network_prefix)}.240"
        
        # Get DNS servers from VLAN configuration
        dns_servers = []
        if 'dhcp' in vlan and 'dnsServers' in vlan['dhcp'] and vlan['dhcp']['dnsServers']:
            dns_servers = vlan['dhcp']['dnsServers']
        else:
            # Default to the gateway IP if no DNS servers specified
            dns_servers = [gateway]
        
        # Format DNS servers for Kea (comma-separated list)
        dns_servers_str = ','.join(dns_servers)
        
        subnet_config = {
            "id": vlan_id,
            "subnet": network,
            "pools": [
                {
                    "pool": f"{pool_start}-{pool_end}"
                }
            ],
            "option-data": [
                {
                    "name": "routers",
                    "data": gateway
                },
                {
                    "name": "domain-name-servers",
                    "data": dns_servers_str
                }
            ]
        }

        # Preserve reservations if this subnet already existed
        if network in existing_vlans:
            existing_subnet = existing_vlans[network]
            if 'reservations' in existing_subnet:
                subnet_config['reservations'] = existing_subnet['reservations']

        new_subnets.append(subnet_config)

    # Final updated subnets
    kea_config['Dhcp4']['subnet4'] = new_subnets

    # Update the interfaces-config section
    update_kea_interfaces(kea_config, vlans, darkflows_map)

    # Write out the updated config
    with open(KEA_CONFIG_PATH, 'w') as f:
        json.dump(kea_config, f, indent=2)

    # Optionally restart KEA
    # os.system('systemctl restart kea-dhcp4-server')

def update_kea_interfaces(kea_config, vlans, darkflows_map):
    """
    Update the interfaces list in Kea's interfaces-config section.
    Adds both the base LAN interfaces and VLAN interfaces that should be there.
    Removes any interfaces that shouldn't be in the list.
    """
    # Ensure we have an interfaces-config section
    if 'interfaces-config' not in kea_config['Dhcp4']:
        kea_config['Dhcp4']['interfaces-config'] = {
            "interfaces": [],
            "dhcp-socket-type": "raw",
            "service-sockets-max-retries": 200000,
            "service-sockets-retry-wait-time": 5000
        }
    elif 'interfaces' not in kea_config['Dhcp4']['interfaces-config']:
        kea_config['Dhcp4']['interfaces-config']['interfaces'] = []

    # Get base interfaces and VLAN interfaces
    base_interfaces = set()
    vlan_interfaces = set()

    # Map label -> darkflows config key
    label_map = {
        "internal": "INTERNAL_INTERFACE",
        "primary": "PRIMARY_INTERFACE",
        "secondary": "SECONDARY_INTERFACE",
        # Add more if needed
    }

    # Collect all interfaces from vlans
    for vlan in vlans:
        label = vlan['networkCard'].get('label', '').lower()
        vlan_id = vlan['id']
        
        if label in label_map:
            config_key = label_map[label]
            device_name = darkflows_map.get(config_key, "lan0")  # fallback
        else:
            # Fallback to deviceName if label not recognized
            device_name = vlan['networkCard'].get('deviceName', 'lan0')
        
        base_interfaces.add(device_name)
        vlan_interfaces.add(f"{device_name}.{vlan_id}")
    
    # Only include base interfaces that are actually used in VLANs
    # We don't automatically add all interfaces from darkflows_map anymore
    
    # Fallback to lan0 if no interfaces found
    if not base_interfaces:
        base_interfaces.add('lan0')
    
    # Combine all interfaces that should be in the list
    all_interfaces = sorted(list(base_interfaces) + sorted(list(vlan_interfaces)))
    
    # Set the updated interfaces list
    kea_config['Dhcp4']['interfaces-config']['interfaces'] = all_interfaces

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

