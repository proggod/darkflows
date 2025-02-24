#!/usr/bin/env python3
import os
import re
import time
import shutil
import subprocess
import MySQLdb  # Provided by python3-mysqldb

# === CONFIGURATION ===

UNBOUND_CONFIG_DIR = "/etc/unbound/unbound.conf.d"
UNBOUND_CONFIG_FILENAME = "50-shm-logging.conf"
UNBOUND_CONFIG_PATH = os.path.join(UNBOUND_CONFIG_DIR, UNBOUND_CONFIG_FILENAME)

SHM_LOG_PATH = "/dev/shm/unbound.log"
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB

# MySQL settings using local socket (no authentication)
MYSQL_CONFIG = {
    "host": "localhost",
    "unix_socket": "/var/run/mysqld/mysqld.sock",
    "user": "root",      # adjust if needed
    "passwd": "",        # leave empty if not required
}

DB_NAME = "dns_logs"
TABLE_NAME = "dns_queries"

# Regular expressions for parsing log lines
REFUSED_REGEX = re.compile(
    r"(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?(?P<status>refused).*?from\s+(?P<client>[\d\.]+).*?for\s+(?P<domain>[\w\.-]+)",
    re.IGNORECASE,
)
ALLOWED_REGEX = re.compile(
    r"(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*?query from\s+(?P<client>[\d\.]+).*?for\s+(?P<domain>[\w\.-]+)",
    re.IGNORECASE,
)

# === FUNCTIONS ===

def configure_unbound_logging():
    """
    Write a config file to the Unbound .d directory to force logging to /dev/shm/unbound.log.
    """
    config_content = (
        "server:\n"
        "    logfile: \"{}\"\n"
        "    verbosity: 3\n"
        "    log-queries: yes\n"
        "    log-replies: yes\n"
        "    use-syslog: no\n".format(SHM_LOG_PATH)
    )
    try:
        with open(UNBOUND_CONFIG_PATH, "w") as f:
            f.write(config_content)
        print("Unbound logging configuration written to {}".format(UNBOUND_CONFIG_PATH))
    except Exception as e:
        print("Error writing Unbound config: {}".format(e))


def reload_unbound():
    """
    Reload Unbound configuration using unbound-control reload.
    """
    try:
        subprocess.run(["unbound-control", "reload"], check=True)
        print("Unbound reloaded successfully.")
    except Exception as e:
        print("Error reloading Unbound: {}".format(e))


def ensure_log_file():
    """
    Ensure that the log file exists and has the proper permissions.
    """
    if not os.path.exists(SHM_LOG_PATH):
        try:
            # Create an empty file
            with open(SHM_LOG_PATH, "a") as f:
                pass
            # Set permissions to 0666 (read and write for everyone)
            os.chmod(SHM_LOG_PATH, 0o666)
            print("Created empty log file at {} with permissions 0666".format(SHM_LOG_PATH))
        except Exception as e:
            print("Error creating log file: {}".format(e))
    else:
        # If it exists, ensure its permissions are set correctly.
        try:
            os.chmod(SHM_LOG_PATH, 0o666)
        except Exception as e:
            print("Error setting permissions on log file: {}".format(e))


def init_mysql():
    """
    Connect to MySQL using MySQLdb, create the database and table if they don't exist.
    """
    try:
        # Connect without specifying a database first
        cnx = MySQLdb.connect(db=DB_NAME, **MYSQL_CONFIG)
    except MySQLdb.OperationalError as e:
        # Database might not exist yet
        if e.args[0] == 1049:  # Unknown database error code
            cnx = MySQLdb.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            try:
                cursor.execute("CREATE DATABASE {} DEFAULT CHARACTER SET 'utf8'".format(DB_NAME))
                cnx.commit()
                print("Created database '{}'.".format(DB_NAME))
            except Exception as err:
                print("Failed creating database: {}".format(err))
                exit(1)
            cursor.close()
            cnx.close()
            # Connect again to the newly created database
            cnx = MySQLdb.connect(db=DB_NAME, **MYSQL_CONFIG)
        else:
            print("MySQL operational error: {}".format(e))
            exit(1)
    
    cursor = cnx.cursor()
    table_description = (
        "CREATE TABLE IF NOT EXISTS {} ("
        "  id INT AUTO_INCREMENT PRIMARY KEY,"
        "  ts DATETIME NOT NULL,"
        "  client_ip VARCHAR(45),"
        "  domain VARCHAR(255),"
        "  query_type VARCHAR(20) DEFAULT 'unknown',"
        "  status VARCHAR(20)"
        ") ENGINE=InnoDB".format(TABLE_NAME)
    )
    try:
        cursor.execute(table_description)
        cnx.commit()
        print("MySQL database '{}' and table '{}' are ready.".format(DB_NAME, TABLE_NAME))
    except Exception as err:
        print("Failed creating table: {}".format(err))
        exit(1)
    cursor.close()
    return cnx


def rotate_log_if_needed():
    """
    Check the log file size and rotate it if needed.
    """
    try:
        if os.path.exists(SHM_LOG_PATH):
            size = os.path.getsize(SHM_LOG_PATH)
            if size >= MAX_LOG_SIZE:
                rotated_path = SHM_LOG_PATH + "." + time.strftime("%Y%m%d%H%M%S")
                shutil.move(SHM_LOG_PATH, rotated_path)
                # Re-create the log file with correct permissions
                with open(SHM_LOG_PATH, "a") as f:
             



