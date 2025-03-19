#!/usr/bin/env python3
"""
Script to fetch Tailscale hosts and add them directly to Unbound configuration.
Updates all Unbound instances across different VLANs with Tailscale host information.
Only updates configurations that have actually changed.
"""

import json
import subprocess
import argparse
import ipaddress
import logging
import sys
import os, signal
import re
import glob
import time
from typing import Dict, List, Any, Optional, Set, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_DOMAIN_SUFFIX = "darkflows.com"
ETC_UNBOUND_DIR = "/etc/darkflows/unbound"
VLANS_JSON = "/etc/darkflows/vlans.json"

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Sync Tailscale hosts to Unbound DNS config')
    parser.add_argument('--domain', default=DEFAULT_DOMAIN_SUFFIX,
                        help=f'Domain suffix (default: {DEFAULT_DOMAIN_SUFFIX})')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    parser.add_argument('--dry-run', action='store_true',
                        help='Do not write to config file, just print what would be done')
    parser.add_argument('--force', '-f', action='store_true',
                        help='Force update even if no changes are detected')
    parser.add_argument('--vlan-id', type=int,
                        help='Update only the specified VLAN ID (if not specified, updates all VLANs)')
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

def read_existing_config(config_file: str) -> Set[str]:
    """
    Read the existing Unbound configuration file and extract DNS entries.
    Returns a set of normalized DNS entries for comparison.
    """
    entries = set()
    
    if not os.path.exists(config_file):
        logger.info(f"Config file {config_file} does not exist yet")
        return entries
    
    try:
        with open(config_file, 'r') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith('#') or line == "server:":
                    continue
                    
                # Extract and normalize the DNS entries
                # We're only interested in the actual DNS mappings
                if "local-data:" in line or "local-data-ptr:" in line:
                    # Normalize by removing whitespace and quotes
                    normalized = re.sub(r'\s+', ' ', line).strip()
                    entries.add(normalized)
                    
        logger.debug(f"Read {len(entries)} existing entries from {config_file}")
        return entries
    except Exception as e:
        logger.warning(f"Could not read existing config file {config_file}: {e}")
        return set()

def extract_config_entries(config_content: str) -> Set[str]:
    """
    Extract DNS entries from the generated config content.
    Returns a set of normalized DNS entries for comparison.
    """
    entries = set()
    
    for line in config_content.split('\n'):
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith('#') or line == "server:":
            continue
            
        # Extract and normalize the DNS entries
        if "local-data:" in line or "local-data-ptr:" in line:
            # Normalize by removing whitespace and quotes
            normalized = re.sub(r'\s+', ' ', line).strip()
            entries.add(normalized)
    
    return entries

def generate_unbound_config(hosts: List[Dict[str, Any]], domain_suffix: str) -> Tuple[str, Set[str]]:
    """Generate Unbound config file content and return the set of entries."""
    config_lines = [
        "# Tailscale hosts for " + domain_suffix,
        "# Auto-generated on " + subprocess.run(['date'], capture_output=True, text=True).stdout.strip(),
        "server:"
    ]
    
    # Track hostnames to handle duplicates
    seen_hostnames = set()
    entries = set()
    
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
                
                # Create A/AAAA record line
                a_record = f"  local-data: \"{full_domain}. IN {'A' if ip_obj.version == 4 else 'AAAA'} {ip}\""
                config_lines.append(a_record)
                entries.add(re.sub(r'\s+', ' ', a_record).strip())
                
                # Create PTR record line
                if ip_obj.version == 4:
                    ptr_record = f"  local-data-ptr: \"{ip} {full_domain}\""
                else:
                    # IPv6 addresses need special handling for PTR records
                    # We'll keep it simple for now as Unbound handles the conversion
                    ptr_record = f"  local-data-ptr: \"{ip} {full_domain}\""
                
                config_lines.append(ptr_record)
                entries.add(re.sub(r'\s+', ' ', ptr_record).strip())
                
                logger.debug(f"Added: {ip} -> {full_domain}")
            except ValueError as e:
                logger.warning(f"Invalid IP address: {ip} for host {hostname}: {e}")
    
    return "\n".join(config_lines), entries

def write_config_file(config_content: str, config_file: str, dry_run: bool = False) -> bool:
    """Write the generated config to the specified file."""
    if dry_run:
        logger.info(f"DRY RUN - Would write to config file: {config_file}")
        logger.debug(config_content)
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

def restart_unbound_for_vlan(vlan_id: int) -> bool:
    """
    Send SIGHUP to the Unbound process for the specified VLAN.
    
    Args:
        vlan_id: VLAN ID (0 for default)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Determine the screen session name based on VLAN ID
        screen_name = f"unbound_{vlan_id if vlan_id > 0 else 'default'}"
        
        logger.info(f"Restarting Unbound for VLAN {vlan_id} via SIGHUP...")
        
        # First try to find the run_unbound.py process with the specific VLAN ID
        ps_cmd = f"pgrep -f 'run_unbound.py --vlan-id={vlan_id}'"
        ps_result = subprocess.run(ps_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if ps_result.stdout.strip():
            # Found processes with the specific VLAN ID - might be multiple PIDs
            pids = ps_result.stdout.strip().split('\n')
            logger.info(f"Found {len(pids)} run_unbound.py processes for VLAN {vlan_id}")
            
            success = False
            for pid in pids:
                try:
                    pid = pid.strip()
                    if pid:
                        os.kill(int(pid), signal.SIGHUP)
                        logger.info(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
                        success = True
                except Exception as e:
                    logger.error(f"Error sending SIGHUP to PID {pid}: {e}")
            
            return success
        
        # If not found by VLAN ID, try to find by screen session name
        screen_cmd = f"screen -ls | grep {screen_name}"
        screen_result = subprocess.run(screen_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if screen_name in screen_result.stdout:
            # Found a screen session, now find the PID of the run_unbound.py process inside it
            logger.info(f"Found screen session {screen_name} for VLAN {vlan_id}")
            
            # Try to send a command to the screen session to send SIGHUP to the unbound process
            screen_cmd = f"screen -S {screen_name} -X stuff $'\\003'$'\\n'"  # Ctrl+C
            subprocess.run(screen_cmd, shell=True, check=False)
            
            # Wait a moment and then send a command to restart
            time.sleep(1)
            screen_cmd = f"screen -S {screen_name} -X stuff $'/usr/bin/python3 /usr/local/darkflows/bin/run_unbound.py --vlan-id={vlan_id}\\n'"
            subprocess.run(screen_cmd, shell=True, check=False)
            
            logger.info(f"Restarted Unbound in screen session {screen_name} for VLAN {vlan_id}")
            return True
        
        # If still not found, try to find any unbound process and send SIGHUP
        logger.warning(f"Could not find specific process for VLAN {vlan_id}, trying generic approach")
        return restart_unbound()
        
    except Exception as e:
        logger.error(f"Error restarting Unbound for VLAN {vlan_id}: {e}")
        return False

def restart_unbound() -> bool:
    """
    Find all processes running 'run_unbound.py' and send them a SIGHUP.
    Uses 'pgrep -f' to locate processes by command-line pattern.
    """
    try:
        logger.info("Restarting Unbound via SIGHUP to run_unbound.py...")
        ps_result = subprocess.run(["pgrep", "-f", "run_unbound.py"], 
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if not ps_result.stdout.strip():
            logger.warning("No run_unbound.py processes found to send SIGHUP.")
            return False
        
        pids = ps_result.stdout.strip().split('\n')
        logger.info(f"Found {len(pids)} run_unbound.py processes")
        
        success = False
        for pid in pids:
            try:
                pid = pid.strip()
                if pid:
                    os.kill(int(pid), signal.SIGHUP)
                    logger.info(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
                    success = True
            except Exception as e:
                logger.error(f"Error sending SIGHUP to PID {pid}: {e}")
        
        return success
    except subprocess.CalledProcessError as e:
        logger.warning(f"Error running pgrep: {e}")
        return False
    except Exception as e:
        logger.error(f"Error during restart: {e}")
        return False

def read_vlans_json() -> List[Dict]:
    """
    Read and parse the VLANS configuration file.
    
    Returns:
        List of VLAN configurations
    """
    try:
        with open(VLANS_JSON, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"VLANS configuration file {VLANS_JSON} not found. Using default VLAN only.")
        return []
    except Exception as e:
        logger.error(f"Error reading VLANS configuration: {e}")
        return []

def get_vlan_directories() -> List[Tuple[int, str]]:
    """
    Get a list of VLAN directories from the filesystem.
    
    Returns:
        List of tuples (vlan_id, directory_path)
    """
    vlan_dirs = []
    
    # Add default VLAN (1)
    default_dir = os.path.join(ETC_UNBOUND_DIR, "default")
    if os.path.isdir(default_dir):
        vlan_dirs.append((1, default_dir))
    
    # Add numbered VLANs
    for vlan_dir in glob.glob(os.path.join(ETC_UNBOUND_DIR, "[0-9]*")):
        try:
            vlan_id = int(os.path.basename(vlan_dir))
            vlan_dirs.append((vlan_id, vlan_dir))
        except ValueError:
            continue
    
    return vlan_dirs

def update_vlan_config(vlan_id: int, vlan_dir: str, hosts: List[Dict[str, Any]], domain_suffix: str, 
                      dry_run: bool = False, force: bool = False) -> bool:
    """
    Update the Tailscale hosts configuration for a specific VLAN.
    
    Args:
        vlan_id: VLAN ID
        vlan_dir: VLAN directory path
        hosts: List of Tailscale hosts
        domain_suffix: Domain suffix to use
        dry_run: Whether to perform a dry run
        force: Whether to force update even if no changes are detected
        
    Returns:
        True if configuration was updated, False otherwise
    """
    # Ensure the local.d directory exists
    local_d_dir = os.path.join(vlan_dir, "local.d")
    if not os.path.exists(local_d_dir) and not dry_run:
        try:
            os.makedirs(local_d_dir, exist_ok=True)
            logger.info(f"Created local.d directory for VLAN {vlan_id}: {local_d_dir}")
        except Exception as e:
            logger.error(f"Error creating local.d directory for VLAN {vlan_id}: {e}")
            return False
    
    # Generate the config file path
    config_file = os.path.join(local_d_dir, "tailscale-hosts.conf")
    
    # Generate the new configuration
    config_content, new_entries = generate_unbound_config(hosts, domain_suffix)
    
    # Read existing configuration
    existing_entries = read_existing_config(config_file)
    
    # Compare configurations
    if existing_entries == new_entries and not force:
        logger.info(f"No changes detected for VLAN {vlan_id}. Skipping update.")
        return False
    
    # Log differences if verbose
    if logger.level <= logging.DEBUG and existing_entries:
        added = new_entries - existing_entries
        removed = existing_entries - new_entries
        if added:
            logger.debug(f"New entries to be added for VLAN {vlan_id}: {len(added)}")
            for entry in added:
                logger.debug(f"  + {entry}")
        if removed:
            logger.debug(f"Entries to be removed for VLAN {vlan_id}: {len(removed)}")
            for entry in removed:
                logger.debug(f"  - {entry}")
    
    # Write config file if there are changes or force flag is set
    logger.info(f"Changes detected for VLAN {vlan_id}, updating configuration...")
    if write_config_file(config_content, config_file, dry_run):
        if not dry_run:
            # Restart Unbound for this VLAN
            if not restart_unbound_for_vlan(vlan_id):
                logger.warning(f"Failed to restart Unbound for VLAN {vlan_id}. You may need to restart it manually.")
        return True
    else:
        logger.error(f"Failed to write config file for VLAN {vlan_id}")
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
    
    # If a specific VLAN ID is provided, only update that VLAN
    if args.vlan_id is not None:
        vlan_id = args.vlan_id
        vlan_dir = os.path.join(ETC_UNBOUND_DIR, str(vlan_id) if vlan_id > 0 else "default")
        
        if not os.path.isdir(vlan_dir):
            logger.error(f"VLAN directory {vlan_dir} does not exist")
            sys.exit(1)
        
        logger.info(f"Updating configuration for VLAN {vlan_id} only")
        if update_vlan_config(vlan_id, vlan_dir, hosts, args.domain, args.dry_run, args.force):
            logger.info(f"Successfully updated configuration for VLAN {vlan_id}")
        else:
            logger.warning(f"No changes made for VLAN {vlan_id}")
        
        sys.exit(0)
    
    # Default behavior: update all VLANs
    # Get VLAN directories from the filesystem
    vlan_dirs = get_vlan_directories()
    
    if not vlan_dirs:
        logger.error(f"No VLAN directories found in {ETC_UNBOUND_DIR}")
        sys.exit(1)
    
    logger.info(f"Found {len(vlan_dirs)} VLAN directories")
    
    # Update each VLAN
    updated_count = 0
    for vlan_id, vlan_dir in vlan_dirs:
        logger.info(f"Processing VLAN {vlan_id} in directory {vlan_dir}")
        if update_vlan_config(vlan_id, vlan_dir, hosts, args.domain, args.dry_run, args.force):
            updated_count += 1
    
    logger.info(f"Updated {updated_count} out of {len(vlan_dirs)} VLAN configurations")
    logger.info("Done!")

if __name__ == "__main__":
    main()


