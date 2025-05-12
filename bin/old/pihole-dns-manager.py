import argparse
import ipaddress
import re
import subprocess
from pathlib import Path

CUSTOM_LIST = Path("/etc/pihole/custom.list")

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
        with CUSTOM_LIST.open('r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    comments.append(line)
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    ip = parts[0]
                    hosts = parts[1:]
                    # Aggregate hosts for same IP
                    if ip in entries:
                        existing_hosts = entries[ip]
                        for host in hosts:
                            if host not in existing_hosts:
                                existing_hosts.append(host)
                    else:
                        entries[ip] = list(hosts)
    except FileNotFoundError:
        pass
    return entries, comments

def write_entries(entries, comments):
    with CUSTOM_LIST.open('w') as f:
        f.write("\n".join(comments) + "\n")
        for ip, hosts in entries.items():
            f.write(f"{ip} {' '.join(hosts)}\n")

def list_entries():
    entries, _ = read_entries()
    for ip, hosts in entries.items():
        print(f"{ip} -> {', '.join(hosts)}")

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
        del entries[target]
        removed = True
    else:
        for ip, hosts in list(entries.items()):
            if target in hosts:
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
    subprocess.run(["pihole", "restartdns", "reload"], check=True)

def main():
    parser = argparse.ArgumentParser(description="Pi-hole DNS Manager")
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


