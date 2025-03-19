#!/usr/bin/env python3
import argparse
import ipaddress
import re
import subprocess
import signal
import os
from pathlib import Path
import sys

# Base directory for Unbound configurations
BASE_DIR = Path("/etc/darkflows/unbound")

def get_config_path(vlan_id: str = "default") -> Path:
    """Get the configuration path for a given VLAN ID."""
    if vlan_id == "1":
        vlan_id = "default"
    return BASE_DIR / vlan_id / "local.d/custom-records.conf"

def validate_ip(ip):
    try:
        return ipaddress.ip_address(ip)
    except ValueError:
        raise ValueError(f"Invalid IP address: {ip}")

def validate_hostname(hostname):
    if not re.match(r"^([a-z0-9\-]+\.)*[a-z0-9\-]+$", hostname, re.IGNORECASE):
        raise ValueError(f"Invalid hostname: {hostname}")
    return hostname.lower()

def read_entries(vlan_id: str = "default"):
    entries = {}
    comments = []
    config_path = get_config_path(vlan_id)
    
    print(f"Reading entries from: {config_path}")
    
    try:
        with config_path.open('r') as f:
            current_ip = None
            
            for line in f:
                line = line.strip()
                print(f"Reading line: {line}")
                
                if not line or line.startswith("#"):
                    comments.append(line)
                    continue
                
                # Look for local-data entries
                local_data_match = re.match(r'local-data: "([^"]+)\s+IN\s+A\s+([^"]+)"', line)
                if local_data_match:
                    hostname, ip = local_data_match.groups()
                    hostname = hostname.lower()
                    print(f"Found local-data entry: {hostname} -> {ip}")
                    
                    if ip in entries:
                        if hostname not in entries[ip]:
                            entries[ip].append(hostname)
                    else:
                        entries[ip] = [hostname]
                
                # Look for local-data-ptr entries
                local_data_ptr_match = re.match(r'local-data-ptr: "([^"]+)\s+([^"]+)"', line)
                if local_data_ptr_match:
                    ip, hostname = local_data_ptr_match.groups()
                    hostname = hostname.lower()
                    print(f"Found local-data-ptr entry: {ip} -> {hostname}")
                    
                    if ip in entries:
                        if hostname not in entries[ip]:
                            entries[ip].append(hostname)
                    else:
                        entries[ip] = [hostname]
    
    except FileNotFoundError:
        print(f"Config file not found: {config_path}")
        # Create directory if it doesn't exist
        os.makedirs(config_path.parent, exist_ok=True)
    
    print(f"Final entries: {entries}")
    return entries, comments

def write_entries(entries, comments, vlan_id: str = "default"):
    config_path = get_config_path(vlan_id)
    with config_path.open('w') as f:
        f.write("\n".join(comments) + "\n" if comments else "")
        f.write("server:\n")
        
        for ip, hostnames in entries.items():
            for hostname in hostnames:
                f.write(f'  local-data: "{hostname} IN A {ip}"\n')
                f.write(f'  local-data-ptr: "{ip} {hostname}"\n')

def list_entries(vlan_id: str = "default"):
    entries, _ = read_entries(vlan_id)
    
    if not entries:
        print("No DNS entries found.")
        return
        
    for ip, hostnames in entries.items():
        print(f"{ip} -> {', '.join(hostnames)}")

def add_entry(ip, hostname, vlan_id: str = "default"):
    entries, comments = read_entries(vlan_id)
    ip_str = str(validate_ip(ip))
    hostname = validate_hostname(hostname)
    
    if ip_str in entries:
        if hostname in entries[ip_str]:
            print(f"Entry exists: {hostname} -> {ip_str}")
            return
        entries[ip_str].append(hostname)
    else:
        entries[ip_str] = [hostname]
    
    write_entries(entries, comments, vlan_id)
    restart_dns()
    print(f"Added: {hostname} -> {ip_str}")

def remove_entry(target, vlan_id: str = "default"):
    print(f"Attempting to remove target: {target} from VLAN: {vlan_id}")
    entries, comments = read_entries(vlan_id)
    removed = False
    
    print(f"Current entries before removal: {entries}")
    
    # First try to find if target is a hostname
    for ip, hostnames in list(entries.items()):
        print(f"Checking IP {ip} with hostnames {hostnames}")
        if target in hostnames:
            print(f"Found target {target} in hostnames for IP {ip}")
            entries[ip].remove(target)
            if not entries[ip]:
                del entries[ip]
            removed = True
            break
    
    # If not found as hostname, try as IP
    if not removed and target in entries:
        print(f"Found target {target} as IP")
        del entries[target]
        removed = True
    
    if removed:
        print(f"Entry found and removed. New entries: {entries}")
        write_entries(entries, comments, vlan_id)
        restart_dns()
        print(f"Removed {target}")
    else:
        print(f"Entry not found. Target: {target}, Current entries: {entries}")
        print("Entry not found")

def restart_dns():
    """
    Find all processes running 'run_unbound.py' and send them a SIGHUP.
    Uses 'pgrep -f' to locate processes by command-line pattern.
    """
    try:
        output = subprocess.check_output(["pgrep", "-f", "run_unbound.py"]).decode().split()
        if not output:
            print("No run_unbound.py processes found to send SIGHUP.")
            return
        for pid in output:
            try:
                os.kill(int(pid), signal.SIGHUP)
                print(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
            except Exception as e:
                print(f"Error sending SIGHUP to PID {pid}: {e}")
    except subprocess.CalledProcessError:
        print("No run_unbound.py processes found.")

def main():
    parser = argparse.ArgumentParser(description="Unbound DNS Manager")
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    list_parser = subparsers.add_parser('list', help='List all entries')
    list_parser.add_argument('vlan_id', nargs='?', default="default", help='VLAN ID (default: default)')
    
    add_parser = subparsers.add_parser('add', help='Add entry')
    add_parser.add_argument('ip', type=validate_ip, help='IP address')
    add_parser.add_argument('hostname', type=validate_hostname, help='Hostname')
    add_parser.add_argument('vlan_id', nargs='?', default="default", help='VLAN ID (default: default)')
    
    remove_parser = subparsers.add_parser('remove', help='Remove entry')
    remove_parser.add_argument('target', help='IP or hostname to remove')
    remove_parser.add_argument('vlan_id', nargs='?', default="default", help='VLAN ID (default: default)')

    args = parser.parse_args()

    try:
        if args.command == 'list':
            list_entries(args.vlan_id)
        elif args.command == 'add':
            add_entry(str(args.ip), args.hostname, args.vlan_id)
        elif args.command == 'remove':
            remove_entry(args.target, args.vlan_id)
    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()

