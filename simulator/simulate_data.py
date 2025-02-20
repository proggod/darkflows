import json
import time
import random
from datetime import datetime, timedelta
import os
from pathlib import Path
import sqlite3

# Base paths
BASE_DIR = '/usr/local/darkflows/simulator'
SIMDATA_DIR = f'{BASE_DIR}/simdata'
DEV_SHM = '/dev/shm/test'

# Database path
DB_PATH = f'{SIMDATA_DIR}/network_data.db'

# JSON output paths
BANDWIDTH_JSON = f'{DEV_SHM}/bandwidth.json'
PING_JSON = f'{DEV_SHM}/ping_status.json'
STATUS_JSON = f'{DEV_SHM}/status.json'

# Define expected data structures
BANDWIDTH_STRUCTURE = {
    "timestamp": float,  # Unix timestamp
    "hosts": {
        "ip_address": {
            "last_2s_sent": "str",  # Format: "Nb" where N is number
            "last_10s_sent": "str",  # Format: "NKb" or "NMb"
            "last_40s_sent": "str",  # Format: "NKb" or "NMb"
            "cumulative_sent": "str",  # Format: "NMB" or "NGB"
            "last_2s_received": "str",
            "last_10s_received": "str",
            "last_40s_received": "str",
            "cumulative_received": "str",
            "last_updated": float  # Unix timestamp
        }
    },
    "status": "str"  # "active" or other status
}

# Host categories for simulation
HIGH_TRAFFIC_IPS = [
    "192.168.0.96",
    "192.168.1.103",
    "192.168.1.50"
]

MEDIUM_TRAFFIC_IPS = [
    "192.168.1.197",
    "192.168.0.70",
    "192.168.1.10",
    "192.168.0.152"
]

LOW_TRAFFIC_IPS = [
    "192.168.0.135", "192.168.0.98", "192.168.0.15", "192.168.0.30",
    "192.168.0.25", "192.168.0.54", "192.168.0.11", "192.168.0.40",
    "192.168.0.41", "192.168.0.59", "192.168.0.13", "192.168.0.18",
    "192.168.0.29", "192.168.0.38", "192.168.0.39", "192.168.0.47",
    "192.168.0.28", "192.168.0.26", "192.168.0.24", "192.168.0.27"
]

# Ensure required directories exist
Path(SIMDATA_DIR).mkdir(parents=True, exist_ok=True)

class DataSimulator:
    def __init__(self):
        self.base_timestamp = datetime.now()
        self.cycle_duration = 15 * 60  # 15 minutes in seconds
        
    def generate_bandwidth_data(self):
        hosts = {}
        
        # Add hosts with different traffic profiles
        for ip in HIGH_TRAFFIC_IPS:
            hosts[ip] = self._generate_host_stats(high_traffic=True)
        for ip in MEDIUM_TRAFFIC_IPS:
            hosts[ip] = self._generate_host_stats(high_traffic=False, medium_traffic=True)
        for ip in LOW_TRAFFIC_IPS:
            hosts[ip] = self._generate_host_stats(high_traffic=False, medium_traffic=False)
        
        return {
            "timestamp": time.time(),
            "hosts": hosts,
            "status": "active"
        }
    
    def _generate_host_stats(self, high_traffic=False, medium_traffic=False):
        if high_traffic:
            multiplier = 100
            size_suffix = ['Mb', 'GB']
        elif medium_traffic:
            multiplier = 10
            size_suffix = ['Kb', 'MB']
        else:
            multiplier = 1
            size_suffix = ['b', 'KB']
        
        return {
            "last_2s_sent": f"{random.randint(0, 100)}b",
            "last_10s_sent": f"{random.randint(5, 500 * multiplier)}{size_suffix[0]}",
            "last_40s_sent": f"{random.randint(10, 1000 * multiplier)}{size_suffix[0]}",
            "cumulative_sent": f"{random.randint(1, 10)}{size_suffix[1]}",
            "last_2s_received": f"{random.randint(0, 100)}b",
            "last_10s_received": f"{random.randint(5, 1000 * multiplier)}{size_suffix[0]}",
            "last_40s_received": f"{random.randint(10, 2000 * multiplier)}{size_suffix[0]}",
            "cumulative_received": f"{random.randint(1, 100)}{size_suffix[1]}",
            "last_updated": time.time()
        }

    def generate_ping_data(self):
        return {
            "timestamp": self.base_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "servers": {
                "PRIMARY": self._generate_server_stats(40, 50),
                "SECONDARY": self._generate_server_stats(35, 60)
            }
        }
    
    def _generate_server_stats(self, min_ping, max_ping):
        samples = [random.randint(min_ping, max_ping) for _ in range(25)]
        return {
            "ping_delay_ms": samples[-1],
            "rolling_avg_ms": sum(samples) // len(samples),
            "packet_loss": random.random() < 0.05,
            "highest_ping": max(samples),
            "lowest_ping": min(samples),
            "samples": str(samples)
        }

    def generate_status_data(self):
        return {
            "timestamp": self.base_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "interfaces": {
                "lan0": self._generate_interface_stats(low_traffic=True),
                "lan1": self._generate_interface_stats(low_traffic=False),
                "lan2": self._generate_interface_stats(low_traffic=True),
                "ifb0": self._generate_interface_stats(low_traffic=False)
            }
        }
    
    def _generate_interface_stats(self, low_traffic):
        drops = random.randint(0, 100) if low_traffic else random.randint(500, 8000)
        memory = random.randint(500000, 1000000) if low_traffic else random.randint(8000000, 9000000)
        return {
            "new_drops": drops,
            "backlog": random.randint(0, 2),
            "memory": memory
        }

    def simulate(self):
        start_time = time.time()
        iteration_count = 0
        print("Starting data simulation...")
        
        while True:
            try:
                current_time = time.time()
                elapsed = current_time - start_time
                cycle_remaining = self.cycle_duration - (elapsed % self.cycle_duration)
                minutes_left = int(cycle_remaining // 60)
                seconds_left = int(cycle_remaining % 60)
                
                # Clear line and print status
                print(f"\rSimulating data: {minutes_left:02d}:{seconds_left:02d} until cycle reset | "
                      f"Cycle progress: {((elapsed % self.cycle_duration)/self.cycle_duration)*100:0.1f}% | "
                      f"Iterations: {iteration_count:,}", end='', flush=True)
                
                # Generate and save bandwidth data
                bandwidth_data = self.generate_bandwidth_data()
                with open(BANDWIDTH_JSON, 'w') as f:
                    json.dump(bandwidth_data, f, indent=2)

                # Generate and save ping data
                ping_data = self.generate_ping_data()
                with open(PING_JSON, 'w') as f:
                    json.dump(ping_data, f, indent=2)

                # Generate and save status data
                status_data = self.generate_status_data()
                with open(STATUS_JSON, 'w') as f:
                    json.dump(status_data, f, indent=2)

                # Update timestamp for next iteration
                self.base_timestamp += timedelta(seconds=1)
                if (self.base_timestamp - datetime.now()).total_seconds() >= self.cycle_duration:
                    self.base_timestamp = datetime.now()
                    print("\nStarting new 15-minute cycle...")  # New line at cycle reset

                iteration_count += 1
                time.sleep(1)
                
            except Exception as e:
                print(f"\nError simulating data: {e}")
                continue

    def get_historical_data(self, hours=1):
        """Get historical data from SQLite to help with simulation"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        try:
            # Get bandwidth patterns
            cursor.execute('''
                SELECT host, 
                       AVG(CAST(REPLACE(REPLACE(last_2s_sent, 'b', ''), 'K', '*1024') AS FLOAT)) as avg_sent,
                       MAX(CAST(REPLACE(REPLACE(last_2s_sent, 'b', ''), 'K', '*1024') AS FLOAT)) as max_sent
                FROM bandwidth_data 
                WHERE timestamp > ? 
                GROUP BY host
            ''', (time.time() - hours * 3600,))
            
            bandwidth_patterns = cursor.fetchall()
            
            # Use these patterns to adjust simulation
            # ... rest of simulation logic
            
        finally:
            conn.close()

if __name__ == "__main__":
    simulator = DataSimulator()
    simulator.simulate() 