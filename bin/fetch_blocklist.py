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

# Use the same DB as verify_blocklists.py
DB_NAME = "unbound"
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
    Load whitelist domains from the database, filtering by VLAN ID.
    Returns a list of domains in lowercase with no trailing dot.
    """
    cursor = cnx.cursor()

    # Default entries (vlan_id = 0) always apply; plus specific VLAN if given
    if vlan_id is None or vlan_id == 0:
        cursor.execute(f"SELECT domain FROM {WHITELIST_TABLE} WHERE vlan_id = 0")
    else:
        cursor.execute(
            f"SELECT domain FROM {WHITELIST_TABLE} WHERE vlan_id IN (0, %s)",
            (vlan_id,)
        )

    rows = cursor.fetchall()
    whitelist = [row[0].lower().rstrip('.') for row in rows]
    cursor.close()

    print(f"Loaded {len(whitelist)} whitelist entries for VLAN {vlan_id or 0}")
    return whitelist

def fetch_blocklist(url):
    """
    Fetch the blocklist from the given URL and extract domains.
    """
    try:
        with urllib.request.urlopen(url) as response:
            content = response.read().decode("utf-8")
    except Exception as e:
        print("Error fetching blocklist: {}".format(e))
        sys.exit(1)

    domains = set()
    pattern = re.compile(
        r'^local-zone:\s+"local-zone:\s+"(?P<domain>[^"]+)"\s+always_null\.',
        re.IGNORECASE
    )
    simple_pattern = re.compile(
        r'^local-zone:\s+"(?P<domain>[^"]+)"\s+always_null',
        re.IGNORECASE
    )

    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = pattern.match(line) or simple_pattern.match(line)
        if m:
            domain = m.group("domain").strip()
            if not domain.endswith("."):
                domain += "."
            domains.add(domain.lower())

    return domains

def is_whitelisted(domain, whitelist):
    """
    Return True if the domain matches or is a subdomain of any whitelist entry.
    """
    domain = domain.lower().rstrip('.')
    for w in whitelist:
        # support wildcard entries (*.example.com)
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
    Return the directory path where the .conf should be written.
    """
    if vlan_id is None or vlan_id == 0:
        config_dir = DEFAULT_DIR
    else:
        config_dir = os.path.join(UNBOUND_BASE_DIR, str(vlan_id))
    ensure_directory_exists(config_dir)

    blacklists_dir = os.path.join(config_dir, "blacklists.d")
    ensure_directory_exists(blacklists_dir)
    return blacklists_dir

def get_blocklist_filename(name, vlan_id=None):
    """
    Build the full path for the blocklist .conf file.
    """
    blacklists_dir = get_blocklist_directory(vlan_id)
    return os.path.join(blacklists_dir, f"{name}.conf")

def write_blocklist_conf(domains, name, vlan_id=None):
    """
    Write out the Unbound configuration file with the filtered domains.
    """
    blocklist_file = get_blocklist_filename(name, vlan_id)
    try:
        with open(blocklist_file, "w") as f:
            f.write('server:\n')
            for domain in sorted(domains):
                f.write(f'  local-zone: "{domain}" always_null\n')
        print(f"Wrote {len(domains)} domains to {blocklist_file}")
    except Exception as e:
        print("Error writing blocklist configuration: {}".format(e))
        sys.exit(1)

def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Fetch and configure DNS blocklist for Unbound.'
    )
    parser.add_argument(
        '--vlan-id', type=int, default=None,
        help='VLAN ID to configure blocklist for. If not specified, uses default (0).'
    )
    parser.add_argument(
        'name', type=str,
        help='Name for the blocklist (will be saved as name.conf)'
    )
    parser.add_argument(
        'url', type=str,
        help='URL to fetch the blocklist from'
    )
    return parser.parse_args()

def main():
    args = parse_arguments()
    name = args.name
    url = args.url
    vlan_id = args.vlan_id or 0

    target = f"VLAN {vlan_id}" if vlan_id else "default instance"
    print(f"Configuring blocklist '{name}' from URL: {url} for {target}")

    # Pull whitelist entries for this VLAN
    cnx = init_whitelist_db()
    whitelist = load_whitelist(cnx, vlan_id)
    cnx.close()

    # Fetch, filter, and write
    blocklist_domains = fetch_blocklist(url)
    print(f"Fetched {len(blocklist_domains)} raw domains.")

    final_blocklist = {
        d for d in blocklist_domains
        if not is_whitelisted(d.rstrip('.'), whitelist)
    }
    filtered_out = len(blocklist_domains) - len(final_blocklist)
    print(f"Excluded {filtered_out} whitelisted domains; {len(final_blocklist)} remain.")

    write_blocklist_conf(final_blocklist, name, vlan_id)

if __name__ == "__main__":
    main()




