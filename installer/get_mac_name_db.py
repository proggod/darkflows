import MySQLdb
import requests
import re
from MySQLdb import Error

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root'
}

DATABASE_NAME = "darkflows"
TABLE_NAME = "mac_vendor_lookup"
OUI_URL = "https://standards-oui.ieee.org/oui.txt"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
}

def create_database_and_table():
    try:
        conn = MySQLdb.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE_NAME}")
        print(f"Database '{DATABASE_NAME}' checked/created")
        cursor.execute(f"USE {DATABASE_NAME}")
        create_table_query = f"""
        CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
            mac_prefix VARCHAR(8) PRIMARY KEY,
            vendor VARCHAR(255) NOT NULL
        )
        """
        cursor.execute(create_table_query)
        print(f"Table '{TABLE_NAME}' checked/created")
    except Error as e:
        print(f"MySQL Error: {e}")
    finally:
        if conn:
            conn.close()

def download_and_parse_oui():
    try:
        print("Downloading OUI data...")
        response = requests.get(OUI_URL, headers=HEADERS)
        response.raise_for_status()
        
        oui_entries = []
        seen_prefixes = set()  # Track seen MAC prefixes
        
        for line in response.text.split('\n'):
            if "(base 16)" in line:
                parts = re.split(r'\s+', line.strip())
                mac_prefix = parts[0].replace('-', ':').lower()[:8]
                
                # Skip duplicates during parsing
                if mac_prefix not in seen_prefixes:
                    seen_prefixes.add(mac_prefix)
                    vendor = ' '.join(parts[3:-1])
                    oui_entries.append((mac_prefix, vendor))
        
        print(f"Parsed {len(oui_entries)} unique entries")
        return oui_entries

    except Exception as e:
        print(f"Error downloading/parsing OUI data: {e}")
        return None

def update_database(oui_entries):
    try:
        conn = MySQLdb.connect(**DB_CONFIG, db=DATABASE_NAME)
        cursor = conn.cursor()
        cursor.execute(f"TRUNCATE TABLE {TABLE_NAME}")
        print("Table cleared")

        BATCH_SIZE = 1000
        total = len(oui_entries)
        
        for i in range(0, total, BATCH_SIZE):
            batch = oui_entries[i:i+BATCH_SIZE]
            insert_query = f"""
            INSERT IGNORE INTO {TABLE_NAME} (mac_prefix, vendor)
            VALUES (%s, %s)
            """
            cursor.executemany(insert_query, batch)
            conn.commit()
            progress = min(i + BATCH_SIZE, total)
            print(f"Inserted {progress}/{total} entries ({progress/total:.1%})")

        print("Database update complete!")

    except Error as e:
        print(f"Database Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_database_and_table()
    oui_data = download_and_parse_oui()
    if oui_data:
        update_database(oui_data)
    else:
        print("Failed to process OUI data")


