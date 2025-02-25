#!/usr/bin/env python3
import json
import MySQLdb
import os

# Path to your Kea DHCPv4 configuration file.
CONFIG_FILE = '/etc/kea/kea-dhcp4.conf'

def load_config(config_file):
    """Load the JSON configuration file."""
    with open(config_file, 'r') as f:
        return json.load(f)

def extract_reservations(config):
    """Extract reservation entries from the config.
    
    This function assumes reservations are defined under each subnet in "Dhcp4" -> "subnet4".
    Each reservation should have an "ip-address", "hw-address", and optionally a "hostname".
    """
    reservations = []
    dhcp4 = config.get("Dhcp4", {})
    for subnet in dhcp4.get("subnet4", []):
        # Use the provided subnet id (or default to 1 if not defined).
        subnet_id = subnet.get("id", 1)
        for res in subnet.get("reservations", []):
            reservations.append({
                "subnet_id": subnet_id,
                "ip_address": res.get("ip-address"),
                "hw_address": res.get("hw-address"),
                "hostname": res.get("hostname", None)
            })
    return reservations

def insert_reservations(reservations, connection):
    """Insert extracted reservations into the 'hosts' table.
    
    Uses ON DUPLICATE KEY UPDATE to avoid duplicate entries.
    """
    cursor = connection.cursor()
    insert_query = (
        "INSERT INTO hosts (dhcp_identifier, dhcp_identifier_type, dhcp4_subnet_id, ipv4_address, hostname) "
        "VALUES (UNHEX(REPLACE(%s, ':', '')), %s, %s, INET_ATON(%s), %s) "
        "ON DUPLICATE KEY UPDATE hostname = hostname"
    )
    for res in reservations:
        # Using 0 as the dhcp_identifier_type for MAC addresses.
        data = (res["hw_address"], 0, res["subnet_id"], res["ip_address"], res["hostname"])
        print("Processing reservation:", data)
        cursor.execute(insert_query, data)
    connection.commit()
    cursor.close()

def main():
    # Load the configuration file.
    config = load_config(CONFIG_FILE)
    reservations = extract_reservations(config)
    print("Found {} reservations.".format(len(reservations)))
    
    # Connect to MySQL using the local socket and the root user.
    try:
        connection = MySQLdb.connect(
            host="localhost",
            user="root",
            unix_socket="/var/run/mysqld/mysqld.sock",
            db="kea"
        )
    except MySQLdb.Error as err:
        print("Error connecting to MySQL:", err)
        return

    try:
        insert_reservations(reservations, connection)
        print("Reservations processed successfully!")
    except MySQLdb.Error as err:
        print("Error inserting reservations:", err)
    finally:
        connection.close()

if __name__ == "__main__":
    main()


