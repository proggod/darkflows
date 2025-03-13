#!/usr/bin/env python3
import subprocess
import sys
import time
import re
import MySQLdb
import signal
import argparse
import os
from collections import deque

# === CONFIGURATION ===

MYSQL_CONFIG = {
    "host": "localhost",
    "unix_socket": "/var/run/mysqld/mysqld.sock",
    "user": "root",      # adjust if needed
    "passwd": "",        # leave empty if not required
}

# Get database name from environment or use default
DB_NAME = os.environ.get("UNBOUND_DB_NAME", "unbound")
TABLE_NAME = "dns_queries"
MAX_DOMAIN_LENGTH = 255  # Maximum length for the domain column

# Parse command line arguments
parser = argparse.ArgumentParser(description='Run Unbound DNS server and log queries.')
parser.add_argument('--vlan-id', type=int, default=0, help='VLAN ID (default: 0 for default instance)')
args = parser.parse_args()

# Get VLAN ID from command line or environment variable
VLAN_ID = args.vlan_id
if VLAN_ID == 0 and "UNBOUND_VLAN_ID" in os.environ:
    try:
        VLAN_ID = int(os.environ["UNBOUND_VLAN_ID"])
    except ValueError:
        print(f"Warning: Invalid VLAN ID in environment: {os.environ['UNBOUND_VLAN_ID']}, using default (0)")

print(f"Starting Unbound for VLAN ID: {VLAN_ID}, using database: {DB_NAME}")

# Deduplication settings
DEDUP_WINDOW = 5.0  # seconds
MAX_PENDING = 25    # maximum number of pending records

# Regex for allowed queries.
CLIENT_REGEX = re.compile(
    r"\[(?P<epoch>\d+)\]\s+unbound\[\d+:\d+\]\s+info:\s+(?P<client>(?:\d{1,3}\.){3}\d{1,3})\s+(?P<domain>[\w\.\-]+)\.\s+A\s+IN",
    re.IGNORECASE,
)

# Regex for blocked queries.
BLOCKED_REGEX = re.compile(
    r"\[(?P<epoch>\d+)\]\s+unbound\[\d+:\d+\]\s+debug:\s+using\s+localzone\s+(?P<domain>[\w\.\-]+)\.\s+always_null",
    re.IGNORECASE,
)

# Pending records stored in a deque.
pending_queue = deque(maxlen=MAX_PENDING)

# Global counters for stats.
total_processed = 0
total_errors = 0
total_allowed = 0
total_blocked = 0

# Global variable for the Unbound process.
proc = None

# === SIGNAL HANDLER ===

def handle_hup(signum, frame):
    """Handle SIGHUP signal to reload Unbound."""
    print("\nReceived SIGHUP signal. Reloading Unbound...")
    global proc
    if proc is not None:
        proc.send_signal(signal.SIGHUP)

# Register the SIGHUP signal handler.
signal.signal(signal.SIGHUP, handle_hup)

# === FUNCTIONS ===

def init_mysql():
    """Connect to MySQL and ensure the database and table exist with proper indexes."""
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
        
        # Define expected table structure
        expected_table_sql = (
            "CREATE TABLE {} ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  ts DATETIME NOT NULL,"
            "  client_ip VARCHAR(45),"
            "  domain VARCHAR({}),"
            "  query_type VARCHAR(20) DEFAULT 'unknown',"
            "  status VARCHAR(20),"
            "  vlan_id INT NOT NULL DEFAULT 0,"
            "  KEY idx_ts (ts),"
            "  KEY idx_domain (domain),"
            "  KEY idx_client_ip (client_ip),"
            "  KEY idx_vlan_id (vlan_id),"
            "  KEY idx_ts_domain (ts, domain),"
            "  KEY idx_ts_client (ts, client_ip),"
            "  KEY idx_ts_vlan (ts, vlan_id)"
            ") ENGINE=InnoDB".format(TABLE_NAME, MAX_DOMAIN_LENGTH)
        )
        
        # Check if table exists
        cursor.execute("SHOW TABLES LIKE '{}'".format(TABLE_NAME))
        table_exists = cursor.fetchone() is not None
        
        if table_exists:
            # Check table structure
            cursor.execute("DESCRIBE {}".format(TABLE_NAME))
            columns = {row[0]: row for row in cursor.fetchall()}
            
            # Check for indexes
            cursor.execute("SHOW INDEX FROM {}".format(TABLE_NAME))
            indexes = {row[2]: row for row in cursor.fetchall()}
            
            # Required columns and indexes
            required_columns = ['id', 'ts', 'client_ip', 'domain', 'query_type', 'status', 'vlan_id']
            required_indexes = ['PRIMARY', 'idx_ts', 'idx_domain', 'idx_client_ip', 'idx_vlan_id', 
                               'idx_ts_domain', 'idx_ts_client', 'idx_ts_vlan']
            
            missing_columns = [col for col in required_columns if col not in columns]
            missing_indexes = [idx for idx in required_indexes if idx not in indexes]
            
            if missing_columns or missing_indexes:
                print("Table {} is missing required columns or indexes. Recreating...".format(TABLE_NAME))
                cursor.execute("DROP TABLE {}".format(TABLE_NAME))
                cursor.execute(expected_table_sql)
                cnx.commit()
                print("Recreated table {} with proper structure".format(TABLE_NAME))
            else:
                print("Table {} has correct structure".format(TABLE_NAME))
        else:
            # Create table
            print("Creating table {}".format(TABLE_NAME))
            cursor.execute(expected_table_sql)
            cnx.commit()
        
        cursor.close()
        print("MySQL database '{}' and table '{}' are ready with indexes.".format(DB_NAME, TABLE_NAME))
        return cnx
    except MySQLdb.Error as err:
        print("MySQL error: {}".format(err))
        sys.exit(1)

def parse_line(line):
    """
    Parse a log line.
    First, try CLIENT_REGEX for allowed queries.
    If that doesn't match, try BLOCKED_REGEX for blocked queries.
    Returns a dict with keys: epoch (int), ts, client, domain, query_type, status,
    or None if no pattern matches.
    """
    m = CLIENT_REGEX.search(line)
    if m:
        parsed = m.groupdict()
        try:
            epoch = int(parsed["epoch"])
        except Exception:
            epoch = int(time.time())
        parsed["epoch"] = epoch
        parsed["ts"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(epoch))
        parsed["status"] = "allowed"
        parsed["query_type"] = "A"
        parsed["vlan_id"] = VLAN_ID  # Add VLAN ID to the parsed data
        if len(parsed.get("domain", "")) > MAX_DOMAIN_LENGTH:
            parsed["domain"] = parsed["domain"][:MAX_DOMAIN_LENGTH]
        return parsed

    m2 = BLOCKED_REGEX.search(line)
    if m2:
        parsed = m2.groupdict()
        try:
            epoch = int(parsed["epoch"])
        except Exception:
            epoch = int(time.time())
        parsed["epoch"] = epoch
        parsed["ts"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(epoch))
        parsed["client"] = "unknown"
        parsed["status"] = "blocked"
        parsed["query_type"] = "A"
        parsed["vlan_id"] = VLAN_ID  # Add VLAN ID to the parsed data
        if len(parsed.get("domain", "")) > MAX_DOMAIN_LENGTH:
            parsed["domain"] = parsed["domain"][:MAX_DOMAIN_LENGTH]
        return parsed

    return None

def insert_log(db_cnx, data):
    """Insert a parsed log record into the MySQL database and return its record ID."""
    try:
        cursor = db_cnx.cursor()
        insert_stmt = (
            "INSERT INTO {} (ts, client_ip, domain, query_type, status, vlan_id) "
            "VALUES (%s, %s, %s, %s, %s, %s)".format(TABLE_NAME)
        )
        cursor.execute(insert_stmt, (
            data["ts"],
            data["client"],
            data["domain"],
            data["query_type"],
            data["status"],
            data["vlan_id"]
        ))
        db_cnx.commit()
        record_id = cursor.lastrowid
        cursor.close()
        return record_id
    except Exception as e:
        print("DB insert error: {}".format(e))
        return None

def update_log(db_cnx, record_id, new_status):
    """Update the status of an existing record."""
    try:
        cursor = db_cnx.cursor()
        update_stmt = "UPDATE {} SET status = %s WHERE id = %s".format(TABLE_NAME)
        cursor.execute(update_stmt, (new_status, record_id))
        db_cnx.commit()
        cursor.close()
        return True
    except Exception as e:
        print("DB update error: {}".format(e))
        return False

def flush_pending(db_cnx):
    """Flush pending queries that have been in the queue longer than DEDUP_WINDOW."""
    global total_allowed, total_blocked
    now = time.time()
    flushed = []
    for pending in list(pending_queue):
        if now - pending["first_seen"] >= DEDUP_WINDOW:
            if not pending.get("inserted", False):
                record_id = insert_log(db_cnx, pending["data"])
                if record_id is not None:
                    pending["inserted"] = True
                    pending["id"] = record_id
                    if pending["data"]["status"] == "blocked":
                        total_blocked += 1
                    else:
                        total_allowed += 1
            flushed.append(pending)
    for item in flushed:
        try:
            pending_queue.remove(item)
        except ValueError:
            continue

def process_line(db_cnx, parsed_data):
    """
    Process a parsed log record using a linked list approach (pending_queue).
    Key: (domain, epoch, vlan_id).
    If a new record with the same key arrives, update its status if blocked.
    """
    key = (parsed_data["domain"], parsed_data["epoch"], parsed_data["vlan_id"])
    found = False
    for pending in pending_queue:
        pending_key = (pending["data"]["domain"], pending["data"]["epoch"], pending["data"]["vlan_id"])
        if pending_key == key:
            if parsed_data["status"] == "blocked" and pending["data"]["status"] != "blocked":
                pending["data"]["status"] = "blocked"
                if pending.get("inserted", False):
                    update_log(db_cnx, pending["id"], "blocked")
            found = True
            break
    if not found:
        pending_queue.append({
            "data": parsed_data,
            "first_seen": time.time(),
            "inserted": False
        })

def print_stats_line():
    """Print the current statistics on one fixed-width line with CR only."""
    stats = "VLAN {}: Processed: {:5d} | Pending: {:3d} | Errors: {:3d} | Allowed: {:5d} | Blocked: {:5d}".format(
        VLAN_ID, total_processed, len(pending_queue), total_errors, total_allowed, total_blocked
    )
    # Add plenty of spaces at the end to overwrite any previous longer line
    padded_stats = stats + " " * 30
    # Use carriage return only (no newline)
    print("\r" + padded_stats, end="", flush=True)

# Remove the time-based throttling since we're going back to continuous updates
last_stats_time = 0
STATS_INTERVAL = 5  # seconds between stats updates

def main():
    global total_processed, total_errors, total_allowed, total_blocked, proc
    db_cnx = init_mysql()

    cmd = ["/usr/sbin/unbound", "-d", "-vvvv"]
    print("Launching Unbound with command: {}".format(" ".join(cmd)))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                break

            # Process any line that contains " A IN" or "always_null"
            if " A IN" not in line and "always_null" not in line.lower():
                continue

            parsed_data = parse_line(line)
            if parsed_data is None:
                continue

            process_line(db_cnx, parsed_data)
            flush_pending(db_cnx)

            total_processed += 1
            print_stats_line()
                
    except KeyboardInterrupt:
        print("\nInterrupted by user. Terminating Unbound...")
        proc.terminate()
    finally:
        flush_pending(db_cnx)
        # Print a newline to ensure final stats appear on their own line
        print("\n")
        print("Final Stats for VLAN {}: Processed: {} | Pending: {} | Errors: {} | Allowed: {} | Blocked: {}"
              .format(VLAN_ID, total_processed, len(pending_queue), total_errors, total_allowed, total_blocked))
        db_cnx.close()

if __name__ == "__main__":
    total_processed = 0
    total_errors = 0
    total_allowed = 0
    total_blocked = 0
    main()


