#!/usr/bin/env python3
"""
Script to fetch Tailscale hosts and add them directly to Unbound configuration.
Creates /etc/unbound/unbound.conf.d/tailscale-domains.conf with .darkflows.com domain suffix.
"""

import json
import subprocess
import argparse
import ipaddress
import logging
import sys
import os, signal
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_DOMAIN_SUFFIX = "darkflows.com"
DEFAULT_CONFIG_FILE = "/etc/unbound/local.d/tailscale-hosts.conf"

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Sync Tailscale hosts to Unbound DNS config')
    parser.add_argument('--domain', default=DEFAULT_DOMAIN_SUFFIX,
                        help=f'Domain suffix (default: {DEFAULT_DOMAIN_SUFFIX})')
    parser.add_argument('--config', default=DEFAULT_CONFIG_FILE,
                        help=f'Unbound config file (default: {DEFAULT_CONFIG_FILE})')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    parser.add_argument('--dry-run', action='store_true',
                        help='Do not write to config file, just print what would be done')
    return parser.parse_args()

def get_tailscale_hosts() -> Dict[str, Any]:
    """Get Tailscale hosts using the tailscale CLI."""
    try:
        result = subprocess.run(
            ['tailscale', 'status', '--json'],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout)
    except subprocess.SubprocessError as e:
        logger.error(f"Failed to run tailscale command: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from tailscale: {e}")
        sys.exit(1)

def extract_hosts_from_tailscale(tailscale_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract all hosts (self and peers) from Tailscale data."""
    hosts = []
    
    # Add self node
    if 'Self' in tailscale_data and 'HostName' in tailscale_data['Self']:
        hosts.append({
            'hostname': tailscale_data['Self']['HostName'],
            'ips': tailscale_data['Self'].get('TailscaleIPs', [])
        })
    
    # Add peer nodes
    if 'Peer' in tailscale_data:
        for peer_id, peer_data in tailscale_data['Peer'].items():
            if 'HostName' in peer_data:
                hosts.append({
                    'hostname': peer_data['HostName'],
                    'ips': peer_data.get('TailscaleIPs', [])
                })
    
    return hosts

def generate_unbound_config(hosts: List[Dict[str, Any]], domain_suffix: str) -> str:
    """Generate Unbound config file content."""
    config_lines = [
        "# Tailscale hosts for " + domain_suffix,
        "# Auto-generated on " + subprocess.run(['date'], capture_output=True, text=True).stdout.strip(),
        "server:"
    ]
    
    # Track hostnames to handle duplicates
    seen_hostnames = set()
    
    # Process each host
    for host in hosts:
        hostname = host['hostname'].lower()
        
        # Handle duplicate hostnames by checking if we've seen this hostname before
        if hostname in seen_hostnames:
            # Skip duplicates
            logger.warning(f"Skipping duplicate hostname: {hostname}")
            continue
            
        seen_hostnames.add(hostname)
        
        for ip in host['ips']:
            try:
                # Validate the IP address
                ip_obj = ipaddress.ip_address(ip)
                full_domain = f"{hostname}.{domain_suffix}"
                
                # Add A/AAAA record
                config_lines.append(f"  local-data: \"{full_domain}. IN {'A' if ip_obj.version == 4 else 'AAAA'} {ip}\"")
                
                # Add PTR record - be careful with IPv6 formatting
                if ip_obj.version == 4:
                    config_lines.append(f"  local-data-ptr: \"{ip} {full_domain}\"")
                else:
                    # IPv6 addresses need special handling for PTR records
                    # We'll keep it simple for now as Unbound handles the conversion
                    config_lines.append(f"  local-data-ptr: \"{ip} {full_domain}\"")
                
                logger.info(f"Added: {ip} -> {full_domain}")
            except ValueError as e:
                logger.warning(f"Invalid IP address: {ip} for host {hostname}: {e}")
    
    return "\n".join(config_lines)

def write_config_file(config_content: str, config_file: str, dry_run: bool = False) -> bool:
    """Write the generated config to the specified file."""
    if dry_run:
        logger.info("DRY RUN - Would write to config file:")
        logger.info(config_content)
        return True
        
    # Make sure the directory exists
    config_dir = os.path.dirname(config_file)
    if not os.path.exists(config_dir):
        try:
            os.makedirs(config_dir, exist_ok=True)
            logger.info(f"Created directory: {config_dir}")
        except PermissionError:
            logger.error(f"Permission denied creating directory: {config_dir}")
            return False
    
    # Write the config file
    try:
        with open(config_file, 'w') as f:
            f.write(config_content)
            
        # Set proper permissions and ownership
        os.chmod(config_file, 0o644)  # rw-r--r--
        
        # Try to set owner to unbound:unbound if running as root
        if os.geteuid() == 0:
            try:
                import pwd, grp
                uid = pwd.getpwnam("unbound").pw_uid
                gid = grp.getgrnam("unbound").gr_gid
                os.chown(config_file, uid, gid)
                logger.debug(f"Set ownership of {config_file} to unbound:unbound")
            except (ImportError, KeyError, PermissionError) as e:
                logger.warning(f"Could not set ownership to unbound:unbound: {e}")
        
        logger.info(f"Config written to: {config_file}")
        return True
    except PermissionError:
        logger.error(f"Permission denied writing to file: {config_file}")
        return False
    except Exception as e:
        logger.error(f"Error writing config file: {e}")
        return False

def restart_unbound() -> bool:
    """
    Find all processes running 'run_unbound.py' and send them a SIGHUP.
    Uses 'pgrep -f' to locate processes by command-line pattern.
    """
    try:
        logger.info("Restarting Unbound via SIGHUP to run_unbound.py...")
        output = subprocess.check_output(["pgrep", "-f", "run_unbound.py"]).decode().split()
        if not output:
            logger.warning("No run_unbound.py processes found to send SIGHUP.")
            return False
        
        success = False
        for pid in output:
            try:
                os.kill(int(pid), signal.SIGHUP)
                logger.info(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
                success = True
            except Exception as e:
                logger.error(f"Error sending SIGHUP to PID {pid}: {e}")
        
        return success
    except subprocess.CalledProcessError:
        logger.warning("No run_unbound.py processes found.")
        return False
    except Exception as e:
        logger.error(f"Error during restart: {e}")
        return False

def main():
    args = parse_arguments()
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info(f"Starting Tailscale to Unbound DNS sync (domain: {args.domain})")
    
    # Get Tailscale hosts
    logger.info("Fetching Tailscale hosts...")
    tailscale_data = get_tailscale_hosts()
    
    # Extract hosts
    hosts = extract_hosts_from_tailscale(tailscale_data)
    logger.info(f"Found {len(hosts)} hosts in Tailscale network")
    
    if not hosts:
        logger.error("No hosts found in Tailscale network")
        sys.exit(1)
    
    # Generate config
    logger.info("Generating Unbound configuration...")
    config_content = generate_unbound_config(hosts, args.domain)
    
    # Write config file
    if write_config_file(config_content, args.config, args.dry_run):
        if not args.dry_run:
            # Restart Unbound using custom method (sending SIGHUP to run_unbound.py)
            if not restart_unbound():
                logger.warning("Failed to signal run_unbound.py for restart. You may need to restart it manually.")
    else:
        logger.error("Failed to write config file")
        sys.exit(1)
    
    logger.info("Done!")

if __name__ == "__main__":
    main()


