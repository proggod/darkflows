#!/usr/bin/env python3
import argparse
import ipaddress
import re
import subprocess
import signal
import os
from pathlib import Path

CUSTOM_CONFIG = Path("/etc/unbound/local.d/custom-records.conf")

def validate_ip(ip):
    try:
        return ipaddress.ip_address(ip)
    except ValueError:
        raise ValueError(f"Invalid IP address: {ip}")

def validate_hostname(hostname):
    if not re.match(r"^([a-z0-9\-]+\.)*[a-z0-9\-]+$", hostname, re.IGNORECASE):
        raise ValueError(f"Invalid hostname: {hostname}")
    return hostname.lower()

def read_entries():
    entries = {}
    comments = []
    
    try:
        with CUSTOM_CONFIG.open('r') as f:
            current_ip = None
            
            for line in f:
                line = line.strip()
                
                if not line or line.startswith("#"):
                    comments.append(line)
                    continue
                
                # Look for local-data entries
                local_data_match = re.match(r'local-data: "([^"]+)\s+IN\s+A\s+([^"]+)"', line)
                if local_data_match:
                    hostname, ip = local_data_match.groups()
                    hostname = hostname.lower()
                    
                    if ip in entries:
                        if hostname not in entries[ip]:
                            entries[ip].append(hostname)
                    else:
                        entries[ip] = [hostname]
    
    except FileNotFoundError:
        # Create directory if it doesn't exist
        os.makedirs(CUSTOM_CONFIG.parent, exist_ok=True)
    
    return entries, comments

def write_entries(entries, comments):
    with CUSTOM_CONFIG.open('w') as f:
        f.write("\n".join(comments) + "\n" if comments else "")
        f.write("server:\n")
        
        for ip, hostnames in entries.items():
            for hostname in hostnames:
                f.write(f'  local-data: "{hostname} IN A {ip}"\n')
                f.write(f'  local-data-ptr: "{ip} {hostname}"\n')

def list_entries():
    entries, _ = read_entries()
    
    if not entries:
        print("No DNS entries found.")
        return
        
    for ip, hostnames in entries.items():
        print(f"{ip} -> {', '.join(hostnames)}")

def add_entry(ip, hostname):
    entries, comments = read_entries()
    ip_str = str(validate_ip(ip))
    hostname = validate_hostname(hostname)
    
    if ip_str in entries:
        if hostname in entries[ip_str]:
            print(f"Entry exists: {hostname} -> {ip_str}")
            return
        entries[ip_str].append(hostname)
    else:
        entries[ip_str] = [hostname]
    
    write_entries(entries, comments)
    restart_dns()
    print(f"Added: {hostname} -> {ip_str}")

def remove_entry(target):
    entries, comments = read_entries()
    removed = False
    
    if target in entries:
        # Target is an IP
        del entries[target]
        removed = True
    else:
        # Target is a hostname
        for ip, hostnames in list(entries.items()):
            if target in hostnames:
                entries[ip].remove(target)
                if not entries[ip]:
                    del entries[ip]
                removed = True
    
    if removed:
        write_entries(entries, comments)
        restart_dns()
        print(f"Removed {target}")
    else:
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
    
    subparsers.add_parser('list', help='List all entries')
    
    add_parser = subparsers.add_parser('add', help='Add entry')
    add_parser.add_argument('ip', type=validate_ip, help='IP address')
    add_parser.add_argument('hostname', type=validate_hostname, help='Hostname')
    
    remove_parser = subparsers.add_parser('remove', help='Remove entry')
    remove_parser.add_argument('target', help='IP or hostname to remove')

    args = parser.parse_args()

    try:
        if args.command == 'list':
            list_entries()
        elif args.command == 'add':
            add_entry(str(args.ip), args.hostname)
        elif args.command == 'remove':
            remove_entry(args.target)
    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()

