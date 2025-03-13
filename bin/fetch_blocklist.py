#!/usr/bin/env python3
import sys
import re
import urllib.request
import MySQLdb
import subprocess
import os
import signal
import argparse

# === CONFIGURATION ===

# MySQL connection settings
MYSQL_CONFIG = {
    "host": "localhost",
    "unix_socket": "/var/run/mysqld/mysqld.sock",
    "user": "root",      # adjust as needed
    "passwd": "",        # leave empty if not required
}

DB_NAME = "dns_logs"
WHITELIST_TABLE = "whitelist"

# Base directories
ETC_DARKFLOWS_DIR = "/etc/darkflows"
UNBOUND_BASE_DIR = os.path.join(ETC_DARKFLOWS_DIR, "unbound")
DEFAULT_DIR = os.path.join(UNBOUND_BASE_DIR, "default")

# === FUNCTIONS ===

def init_whitelist_db():
    """
    Connect to the MySQL database.
    Returns a MySQL connection.
    """
    try:
        try:
            cnx = MySQLdb.connect(db=DB_NAME, **MYSQL_CONFIG)
        except MySQLdb.OperationalError as e:
            if e.args[0] == 1049:  # Database does not exist.
                print(f"Error: Database '{DB_NAME}' does not exist.")
                sys.exit(1)
            else:
                raise
        return cnx
    except MySQLdb.Error as err:
        print("MySQL error: {}".format(err))
        sys.exit(1)

def load_whitelist(cnx, vlan_id=None):
    """
    Load whitelist domains from the database.
    The current table structure doesn't have VLAN support,
    so we load all whitelist entries regardless of VLAN ID.
    Returns a list of domains in lowercase with no trailing dot.
    """
    cursor = cnx.cursor()
    
    # Get all whitelist entries since there's no VLAN column
    cursor.execute("SELECT domain FROM {}".format(WHITELIST_TABLE))
    
    rows = cursor.fetchall()
    whitelist = [row[0].lower().rstrip('.') for row in rows]
    cursor.close()
    
    print(f"Loaded {len(whitelist)} whitelist entries")
    return whitelist

def fetch_blocklist(url):
    """
    Fetch the blocklist from the given URL.
    The fetched file already contains configuration lines.
    We use a regex to extract the domain.
    
    Expected format (one example):
      local-zone: "local-zone: "000ll4q.rcomhost.com." always_null." always_null
    We extract the domain (000ll4q.rcomhost.com.) from the inner quotes.
    Returns a set of domains (each ending with a dot).
    """
    try:
        with urllib.request.urlopen(url) as response:
            content = response.read().decode("utf-8")
    except Exception as e:
        print("Error fetching blocklist: {}".format(e))
        sys.exit(1)
    domains = set()
    # Pattern to match the expected format.
    # This pattern expects lines starting with: local-zone: "local-zone: "
    # then captures everything up to the next double-quote.
    pattern = re.compile(r'^local-zone:\s+"local-zone:\s+"(?P<domain>[^"]+)"\s+always_null\.', re.IGNORECASE)
    # Fallback: try a simpler pattern if the above doesn't match.
    simple_pattern = re.compile(r'^local-zone:\s+"(?P<domain>[^"]+)"\s+always_null', re.IGNORECASE)
    
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = pattern.match(line)
        if not m:
            m = simple_pattern.match(line)
        if m:
            domain = m.group("domain").strip()
            # Ensure domain ends with a dot.
            if not domain.endswith("."):
                domain += "."
            domains.add(domain.lower())
        else:
            # Uncomment below for debugging unmatched lines:
            # print("Could not parse line:", line)
            continue
    return domains

def is_whitelisted(domain, whitelist):
    """
    Return True if the domain is whitelisted.
    A domain is considered whitelisted if it exactly matches a whitelist entry,
    or if it ends with a whitelist entry (supporting wildcard-style entries).
    Both the domain and whitelist entries are compared without trailing dots.
    """
    domain = domain.lower().rstrip('.')
    for w in whitelist:
        if w.startswith("*."):
            w = w[2:]
        if domain == w or domain.endswith("." + w):
            return True
    return False

def ensure_directory_exists(directory_path):
    """
    Ensure that the specified directory exists.
    """
    if not os.path.exists(directory_path):
        print(f"Creating directory: {directory_path}")
        os.makedirs(directory_path, exist_ok=True)

def get_blocklist_directory(vlan_id=None):
    """
    Get the directory for the blocklist configuration based on VLAN ID.
    If VLAN ID is 0 or None, use the default directory.
    Otherwise, use the VLAN-specific directory.
    """
    if vlan_id is None or vlan_id == 0:
        config_dir = DEFAULT_DIR
    else:
        config_dir = os.path.join(UNBOUND_BASE_DIR, str(vlan_id))
    
    # Ensure the config directory exists
    ensure_directory_exists(config_dir)
    
    # Create and return the blacklists.d directory path
    blacklists_dir = os.path.join(config_dir, "blacklists.d")
    ensure_directory_exists(blacklists_dir)
    
    return blacklists_dir

def get_blocklist_filename(name, vlan_id=None):
    """
    Get the filename for the blocklist configuration based on the provided name and VLAN ID.
    The file will be saved as name.conf in the appropriate blacklists.d directory.
    """
    blacklists_dir = get_blocklist_directory(vlan_id)
    return os.path.join(blacklists_dir, f"{name}.conf")

def write_blocklist_conf(domains, name, vlan_id=None):
    """
    Write the Unbound blocklist configuration file.
    Each line will be in the format:
      local-zone: "domain" always_null
    
    The file will be written to the appropriate location based on the provided name and VLAN ID.
    """
    blocklist_file = get_blocklist_filename(name, vlan_id)
    
    try:
        with open(blocklist_file, "w") as f:
            f.write('server:\n')
            for domain in sorted(domains):
                f.write('  local-zone: "{}" always_null\n'.format(domain))
        print("Blocklist configuration written to '{}' with {} domains.".format(blocklist_file, len(domains)))
    except Exception as e:
        print("Error writing blocklist configuration: {}".format(e))
        sys.exit(1)

def reload_unbound():
    """Reload Unbound's configuration."""
    try:
        subprocess.run(["unbound-control", "reload"], check=True)
        print("Unbound reloaded successfully.")
    except Exception as e:
        print("Error reloading Unbound: {}".format(e))

def send_hup_to_run_unbound_scripts(vlan_id=None):
    """
    Find all processes running 'run_unbound.py' and send them a SIGHUP.
    Uses 'pgrep -f' to locate processes by command-line pattern.
    Only matches processes that are actually running the Python script directly,
    not SCREEN sessions or other processes that might have 'run_unbound.py' in their arguments.
    
    Args:
        vlan_id: The VLAN ID to filter processes by. If None, only sends SIGHUP to the default process.
    """
    try:
        # Use a more specific pattern to match only direct Python processes running run_unbound.py
        # This excludes SCREEN processes and only matches the actual Python processes
        pattern = "^/usr/bin/python[0-9]* /usr/local/darkflows/bin/run_unbound\.py"
        print(f"Searching for processes matching: {pattern}")
        
        try:
            output = subprocess.check_output(["pgrep", "-f", pattern]).decode().split()
            print(f"Found {len(output)} run_unbound.py processes: {', '.join(output)}")
        except subprocess.CalledProcessError:
            print("No run_unbound.py processes found.")
            return
        
        if not output:
            print("No run_unbound.py processes found to send SIGHUP.")
            return
            
        # Get the VLAN ID we're configuring for
        vlan_id_arg = f"--vlan-id={vlan_id}" if vlan_id is not None else "--vlan-id=0"
        print(f"Looking for processes with VLAN ID: {vlan_id if vlan_id is not None else '0'}")
        
        # For each process, check if it's for our VLAN before sending SIGHUP
        matching_processes = 0
        for pid in output:
            try:
                # Get the command line for this process
                cmdline = subprocess.check_output(["ps", "-p", pid, "-o", "args="]).decode().strip()
                print(f"Process {pid} command line: {cmdline}")
                
                # If we're configuring a specific VLAN, only send SIGHUP to the process for that VLAN
                # If we're configuring the default instance, only send SIGHUP to the default process with --vlan-id=0
                if vlan_id is not None and vlan_id_arg in cmdline:
                    os.kill(int(pid), signal.SIGHUP)
                    print(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
                    matching_processes += 1
                elif vlan_id is None and "--vlan-id=0" in cmdline:
                    os.kill(int(pid), signal.SIGHUP)
                    print(f"Sent SIGHUP to run_unbound.py process with PID {pid}")
                    matching_processes += 1
                else:
                    print(f"Skipping process {pid} (VLAN ID mismatch)")
            except Exception as e:
                print(f"Error processing PID {pid}: {e}")
        
        if matching_processes == 0:
            print(f"Warning: No matching run_unbound.py processes found for VLAN ID: {vlan_id if vlan_id is not None else '0'}")
        else:
            print(f"Successfully sent SIGHUP to {matching_processes} processes")
    except Exception as e:
        print(f"Error in send_hup_to_run_unbound_scripts: {e}")

def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description='Fetch and configure DNS blocklist for Unbound.')
    parser.add_argument('--vlan-id', type=int, default=None, 
                        help='VLAN ID to configure blocklist for. If not specified, configures the default instance.')
    parser.add_argument('name', type=str, help='Name for the blocklist (will be saved as name.conf)')
    parser.add_argument('url', type=str, help='URL to fetch the blocklist from')
    return parser.parse_args()

def main():
    # Parse command-line arguments
    args = parse_arguments()
    name = args.name
    url = args.url
    vlan_id = args.vlan_id
    
    if vlan_id is not None:
        print(f"Configuring blocklist '{name}' from URL: {url} for VLAN ID: {vlan_id}")
    else:
        print(f"Configuring blocklist '{name}' from URL: {url} for default instance")
    
    # Initialize whitelist DB and load whitelist.
    cnx = init_whitelist_db()
    whitelist = load_whitelist(cnx, vlan_id)
    print("Whitelist loaded: {} domains.".format(len(whitelist)))
    cnx.close()

    # Fetch the blocklist.
    blocklist_domains = fetch_blocklist(url)
    print("Fetched blocklist: {} domains.".format(len(blocklist_domains)))

    # Filter out whitelisted domains.
    final_blocklist = set()
    for domain in blocklist_domains:
        if not is_whitelisted(domain.rstrip("."), whitelist):
            final_blocklist.add(domain)
        else:
            print("Whitelisted (excluded):", domain)

    print("Final blocklist contains {} domains after filtering.".format(len(final_blocklist)))

    # Write the Unbound configuration file.
    write_blocklist_conf(final_blocklist, name, vlan_id)

    # Reload Unbound.
    reload_unbound()

    # Also, send SIGHUP to all running run_unbound.py scripts.
    send_hup_to_run_unbound_scripts(vlan_id)

if __name__ == "__main__":
    main()


