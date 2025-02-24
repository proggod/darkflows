#!/usr/bin/env python3
import subprocess
import sys
import time
import re
import MySQLdb

# === CONFIGURATION ===

# MySQL settings using local socket (no authentication)
MYSQL_CONFIG = {
    "host": "localhost",
    "unix_socket": "/var/run/mysqld/mysqld.sock",
    "user": "root",   # adjust if needed
    "passwd": "",     # leave empty if not required
}

DB_NAME = "dns_logs"
TABLE_NAME = "dns_queries"
MAX_DOMAIN_LENGTH = 255  # Maximum length for the domain column

# Define a regex that matches lines in the format:
# [<epoch>] unbound[<pid>:<something>] info: <client IP> <domain>. A IN
CLIENT_REGEX = re.compile(
    r"\[(?P<epoch>\d+)\]\s+unbound\[\d+:\d+\]\s+info:\s+(?P<client>(?:\d{1,3}\.){3}\d{1,3})\s+(?P<domain>[\w\.\-]+)\.\s+A\s+IN",
    re.IGNORECASE,
)

# === FUNCTIONS ===

def init_mysql():
    """
    Connect to MySQL and ensure the database and table exist.
    The table is created with indexes on ts, domain, client_ip,
    and composite indexes on (ts, domain) and (ts, client_ip).
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
    Parse a log line that matches CLIENT_REGEX.
    Returns a dictionary with keys: ts, client, domain, query_type, status.
    If the line doesn't match, returns None.
    """
    m = CLIENT_REGEX.search(line)
    if not m:
        return None

    parsed = m.groupdict()
    parsed['status'] = "allowed"
    parsed['query_type'] = "A"

    try:
        epoch = int(parsed["epoch"])
        parsed["ts"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(epoch))
    except Exception:
        parsed["ts"] = time.strftime("%Y-%m-%d %H:%M:%S")
    if len(parsed.get("domain", "")) > MAX_DOMAIN_LENGTH:
        parsed["domain"] = parsed["domain"][:MAX_DOMAIN_LENGTH]
    return parsed

def insert_log(db_cnx, data):
    """Insert a parsed log record into the MySQL database."""
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
        cursor.close()
        return True
    except Exception as e:
        print("DB insert error: {}".format(e))
        return False

def main():
    db_cnx = init_mysql()

    # Launch Unbound in foreground debug mode with increased verbosity.
    cmd = ["/usr/sbin/unbound", "-d", "-vv"]
    print("Launching Unbound with command: {}".format(" ".join(cmd)))
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    processed_lines = 0
    error_lines = 0
    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                break

            # Only process lines that contain "info:" and " A IN"
            if "info:" not in line or " A IN" not in line:
                continue

            parsed_data = parse_line(line)
            if parsed_data is None:
                continue

            # Print the raw line
            print(line.rstrip())

            if insert_log(db_cnx, parsed_data):
                processed_lines += 1
                print("Inserted: {} | {} | {} | {} | {}".format(
                    parsed_data["ts"],
                    parsed_data["client"],
                    parsed_data["domain"],
                    parsed_data["query_type"],
                    parsed_data["status"]
                ))
            else:
                error_lines += 1

            print("Processed lines: {} | Errors: {}".format(processed_lines, error_lines), end="\r", flush=True)
    except KeyboardInterrupt:
        print("\nInterrupted by user. Terminating Unbound...")
        proc.terminate()
    finally:
        db_cnx.close()

if __name__ == "__main__":
    main()


