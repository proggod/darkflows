#!/usr/bin/env python3
import subprocess
import sys
import time
import re
import MySQLdb
from collections import deque

# === CONFIGURATION ===

MYSQL_CONFIG = {
    "host": "localhost",
    "unix_socket": "/var/run/mysqld/mysqld.sock",
    "user": "root",      # adjust if needed
    "passwd": "",        # leave empty if not required
}

DB_NAME = "dns_logs"
TABLE_NAME = "dns_queries"
MAX_DOMAIN_LENGTH = 255  # Maximum length for the domain column

# Deduplication settings
DEDUP_WINDOW = 5.0  # seconds
MAX_PENDING = 25    # maximum pending items

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

# We'll use a deque as our fixed-size pending queue.
pending_queue = deque(maxlen=MAX_PENDING)

# Each pending record will be a dict containing:
#   data: the parsed record (including keys: epoch, ts, client, domain, query_type, status)
#   first_seen: time.time() when the record was first buffered
#   inserted: boolean indicating if it has been flushed to DB
#   id: the DB record id (if inserted)

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
        table_sql = (
            "CREATE TABLE IF NOT EXISTS {} ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  ts DATETIME NOT NULL,"
            "  client_ip VARCHAR(45),"
            "  domain VARCHAR({}),"
            "  query_type VARCHAR(20) DEFAULT 'unknown',"
            "  status VARCHAR(20),"
            "  KEY idx_ts (ts),"
            "  KEY idx_domain (domain),"
            "  KEY idx_client_ip (client_ip),"
            "  KEY idx_ts_domain (ts, domain),"
            "  KEY idx_ts_client (ts, client_ip)"
            ") ENGINE=InnoDB".format(TABLE_NAME, MAX_DOMAIN_LENGTH)
        )
        cursor.execute(table_sql)
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
    Try CLIENT_REGEX for allowed queries first.
    If that fails, try BLOCKED_REGEX.
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
        if len(parsed.get("domain", "")) > MAX_DOMAIN_LENGTH:
            parsed["domain"] = parsed["domain"][:MAX_DOMAIN_LENGTH]
        return parsed

    return None

def insert_log(db_cnx, data):
    """Insert a parsed log record into the MySQL database and return its record ID."""
    try:
        cursor = db_cnx.cursor()
        insert_stmt = (
            "INSERT INTO {} (ts, client_ip, domain, query_type, status) "
            "VALUES (%s, %s, %s, %s, %s)".format(TABLE_NAME)
        )
        cursor.execute(insert_stmt, (
            data["ts"],
            data["client"],
            data["domain"],
            data["query_type"],
            data["status"]
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
    now = time.time()
    flushed = []
    # We'll iterate over a copy of the deque.
    for pending in list(pending_queue):
        if now - pending["first_seen"] >= DEDUP_WINDOW:
            # Insert if not already inserted.
            if not pending.get("inserted", False):
                record_id = insert_log(db_cnx, pending["data"])
                if record_id is not None:
                    pending["inserted"] = True
                    pending["id"] = record_id
                    print("Flushed: {} | {} | {} | {} | {}".format(
                        pending["data"]["ts"],
                        pending["data"]["client"],
                        pending["data"]["domain"],
                        pending["data"]["query_type"],
                        pending["data"]["status"]
                    ))
            flushed.append(pending)
    # Remove flushed items from the deque.
    for item in flushed:
        try:
            pending_queue.remove(item)
        except ValueError:
            continue

def process_line(db_cnx, parsed_data):
    """
    Process a parsed log record by adding/updating it in the pending queue.
    Use key = (domain, epoch) so that if multiple lines for the same domain and same second occur,
    we only keep one pending record. If a blocked record comes in, update the pending record.
    """
    key = (parsed_data["domain"], parsed_data["epoch"])
    found = False
    for pending in pending_queue:
        pending_key = (pending["data"]["domain"], pending["data"]["epoch"])
        if pending_key == key:
            # If new line is blocked and pending record is allowed, update status.
            if parsed_data["status"] == "blocked" and pending["data"]["status"] != "blocked":
                pending["data"]["status"] = "blocked"
                # If already inserted, update the database.
                if pending.get("inserted", False):
                    update_log(db_cnx, pending["id"], "blocked")
                    print("Updated record {} to blocked for domain {}.".format(pending["id"], parsed_data["domain"]))
            found = True
            break
    if not found:
        # If the pending queue is full, flush the oldest one.
        if len(pending_queue) >= MAX_PENDING:
            flush_pending(db_cnx)
        pending_queue.append({
            "data": parsed_data,
            "first_seen": time.time(),
            "inserted": False
        })

def main():
    db_cnx = init_mysql()

    # Launch Unbound in foreground debug mode with very high verbosity.
    cmd = ["/usr/sbin/unbound", "-d", "-vvvv"]
    print("Launching Unbound with command: {}".format(" ".join(cmd)))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    processed_lines = 0
    error_lines = 0
    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                break

            # Process lines that contain " A IN" or "always_null"
            if " A IN" not in line and "always_null" not in line.lower():
                continue

            parsed_data = parse_line(line)
            if parsed_data is None:
                continue

            process_line(db_cnx, parsed_data)
            flush_pending(db_cnx)

            processed_lines += 1
            print("Processed lines: {} | Pending: {} | Errors: {}".format(
                processed_lines, len(pending_queue), error_lines
            ), end="\r", flush=True)
    except KeyboardInterrupt:
        print("\nInterrupted by user. Terminating Unbound...")
        proc.terminate()
    finally:
        flush_pending(db_cnx)
        db_cnx.close()

if __name__ == "__main__":
    main()


