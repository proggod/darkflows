import json
import time
import sqlite3
from datetime import datetime
from pathlib import Path

# Base paths
BASE_DIR = '/usr/local/darkflows/simulator'
SIMDATA_DIR = f'{BASE_DIR}/simdata'
DEV_SHM = '/dev/shm'

# Database path
DB_PATH = f'{SIMDATA_DIR}/network_data.db'

# JSON input paths
BANDWIDTH_JSON = f'{DEV_SHM}/bandwidth.json'
PING_JSON = f'{DEV_SHM}/ping_status.json'
STATUS_JSON = f'{DEV_SHM}/status.json'

# Ensure required directories exist
Path(SIMDATA_DIR).mkdir(parents=True, exist_ok=True)

def init_database():
    # Store database in the specified directory
    db_path = DB_PATH
    
    # Ensure directory exists
    Path(SIMDATA_DIR).mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bandwidth_data (
            timestamp REAL,
            host TEXT,
            last_2s_sent TEXT,
            last_10s_sent TEXT,
            last_40s_sent TEXT,
            cumulative_sent TEXT,
            last_2s_received TEXT,
            last_10s_received TEXT,
            last_40s_received TEXT,
            cumulative_received TEXT,
            last_updated REAL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ping_data (
            timestamp TEXT,
            server TEXT,
            ping_delay_ms INTEGER,
            rolling_avg_ms INTEGER,
            packet_loss BOOLEAN,
            highest_ping INTEGER,
            lowest_ping INTEGER,
            samples TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS status_data (
            timestamp TEXT,
            interface TEXT,
            new_drops INTEGER,
            backlog INTEGER,
            memory INTEGER
        )
    ''')
    
    # Create indexes for better query performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_bandwidth_time_host ON bandwidth_data(timestamp, host)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_ping_time_server ON ping_data(timestamp, server)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_status_time_interface ON status_data(timestamp, interface)')
    
    conn.commit()
    return conn

def record_data(conn):
    cursor = conn.cursor()
    start_time = time.time()
    duration = 15 * 60  # 15 minutes in seconds
    record_count = 0

    print("Starting data recording...")
    while time.time() - start_time < duration:
        try:
            elapsed = time.time() - start_time
            remaining = duration - elapsed
            minutes_left = int(remaining // 60)
            seconds_left = int(remaining % 60)
            
            # Clear line and print status
            print(f"\rRecording data: {minutes_left:02d}:{seconds_left:02d} remaining | "
                  f"Progress: {(elapsed/duration)*100:0.1f}% | "
                  f"Records: {record_count:,}", end='', flush=True)
            
            # Read and store bandwidth data
            with open(BANDWIDTH_JSON, 'r') as f:
                bandwidth_data = json.load(f)
                for host, stats in bandwidth_data['hosts'].items():
                    cursor.execute('''
                        INSERT INTO bandwidth_data VALUES 
                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        bandwidth_data['timestamp'],
                        host,
                        stats['last_2s_sent'],
                        stats['last_10s_sent'],
                        stats['last_40s_sent'],
                        stats['cumulative_sent'],
                        stats['last_2s_received'],
                        stats['last_10s_received'],
                        stats['last_40s_received'],
                        stats['cumulative_received'],
                        stats['last_updated']
                    ))
                    record_count += 1

            # Read and store ping data
            with open(PING_JSON, 'r') as f:
                ping_data = json.load(f)
                for server, stats in ping_data['servers'].items():
                    cursor.execute('''
                        INSERT INTO ping_data VALUES 
                        (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        ping_data['timestamp'],
                        server,
                        stats['ping_delay_ms'],
                        stats['rolling_avg_ms'],
                        stats['packet_loss'],
                        stats['highest_ping'],
                        stats['lowest_ping'],
                        stats['samples']
                    ))
                    record_count += 1

            # Read and store status data
            with open(STATUS_JSON, 'r') as f:
                status_data = json.load(f)
                for interface, stats in status_data['interfaces'].items():
                    cursor.execute('''
                        INSERT INTO status_data VALUES 
                        (?, ?, ?, ?, ?)
                    ''', (
                        status_data['timestamp'],
                        interface,
                        stats['new_drops'],
                        stats['backlog'],
                        stats['memory']
                    ))
                    record_count += 1

            # Commit every second's worth of data
            conn.commit()
            time.sleep(1)
            
        except Exception as e:
            print(f"\nError recording data: {e}")
            continue

    print("\nRecording complete!")  # New line at the end

def query_last_values():
    """Helper function to query last values from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get last bandwidth values
        cursor.execute('''
            SELECT * FROM bandwidth_data 
            WHERE timestamp = (SELECT MAX(timestamp) FROM bandwidth_data)
        ''')
        bandwidth = cursor.fetchall()
        
        # Get last ping values
        cursor.execute('''
            SELECT * FROM ping_data 
            WHERE timestamp = (SELECT MAX(timestamp) FROM ping_data)
        ''')
        ping = cursor.fetchall()
        
        # Get last status values
        cursor.execute('''
            SELECT * FROM status_data 
            WHERE timestamp = (SELECT MAX(timestamp) FROM status_data)
        ''')
        status = cursor.fetchall()
        
        return bandwidth, ping, status
        
    finally:
        conn.close()

if __name__ == "__main__":
    conn = init_database()
    try:
        record_data(conn)
    finally:
        conn.close() 