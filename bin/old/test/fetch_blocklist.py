#!/usr/bin/env python3
import sys
import re
import urllib.request
import MySQLdb
import subprocess
import os
import signal

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

# The Unbound blocklist configuration file to create
BLOCKLIST_CONF = "/etc/unbound/unbound.conf.d/blocklist.conf"

# URL to fetch the blocklist from
BLOCKLIST_URL = "https://big.oisd.nl/unbound"

# === FUNCTIONS ===

def init_whitelist_db():
    """
    Connect to the MySQL database and ensure the whitelist table exists.
    The table has one column 'domain' (VARCHAR(255)) as primary key.
    Returns a MySQL connection.
    """
    try:
        try:
            cnx = MySQLdb.connect(db=DB_NAME, **MYSQL_CONFIG)
        except MySQLdb.OperationalError as e:
            if e.args[0] == 1049:  # Database does not exist.
                cnx = MySQLdb.connect(**MYSQL_CONFIG)
                cursor = cnx.cursor()
                cursor.execute("CREATE DATABASE {} DEFAULT CHARACTER SET 'utf8'".format(DB_NAME))
                cnx.commit()
                print("Created database '{}'.".format(DB_NAME))
                cursor.close()
                cnx.close()
                cnx = MySQLdb.connect(db=DB_NAME, **MYSQL_CONFIG)
            else:
                raise
        cursor = cnx.cursor()
        create_table_sql = (
            "CREATE TABLE IF NOT EXISTS {} ("
            "  domain VARCHAR(255) PRIMARY KEY"
            ") ENGINE=InnoDB".format(WHITELIST_TABLE)
        )
        cursor.execute(create_table_sql)
        cnx.commit()
        cursor.close()
        print("Whitelist table '{}' is ready.".format(WHITELIST_TABLE))
        return cnx
    except MySQLdb.Error as err:
        print("MySQL error: {}".format(err))
        sys.exit(1)

def load_whitelist(cnx):
    """
    Load whitelist domains from the database.
    Returns a list of domains in lowercase with no trailing dot.
    """
    cursor = cnx.cursor()
    cursor.execute("SELECT domain FROM {};".format(WHITELIST_TABLE))
    rows = cursor.fetchall()
    whitelist = [row[0].lower().rstrip('.') for row in rows]
    cursor.close()
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

def write_blocklist_conf(domains):
    """
    Write the Unbound blocklist configuration file.
    Each line will be in the format:
      local-zone: "domain" always_null
    """
    try:
        with open(BLOCKLIST_CONF, "w") as f:
            for domain in sorted(domains):
                f.write('local-zone: "{}" always_null\n'.format(domain))
        print("Blocklist configuration written to '{}' with {} domains.".format(BLOCKLIST_CONF, len(domains)))
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

def send_hup_to_run_unbound_scripts():
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
                print("Sent SIGHUP to run_unbound.py process with PID {}".format(pid))
            except Exception as e:
                print("Error sending SIGHUP to PID {}: {}".format(pid, e))
    except subprocess.CalledProcessError:
        print("No run_unbound.py processes found.")

def main():
    # Initialize whitelist DB and load whitelist.
    cnx = init_whitelist_db()
    whitelist = load_whitelist(cnx)
    print("Whitelist loaded: {} domains.".format(len(whitelist)))
    cnx.close()

    # Fetch the blocklist.
    blocklist_domains = fetch_blocklist(BLOCKLIST_URL)
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
    write_blocklist_conf(final_blocklist)

    # Reload Unbound.
    reload_unbound()

    # Also, send SIGHUP to all running run_unbound.py scripts.
    send_hup_to_run_unbound_scripts()

if __name__ == "__main__":
    main()


