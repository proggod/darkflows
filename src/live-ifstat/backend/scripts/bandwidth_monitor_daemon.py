#!/usr/bin/env python3
import subprocess
import json
import re
import time
import sys
import signal
from pathlib import Path

CACHE_FILE = '/dev/shm/bandwidth_usage.json'
UPDATE_INTERVAL = 10  # seconds

def get_network_config():
    config = {}
    try:
        with open('/etc/darkflows/d_network.cfg', 'r') as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    config[key] = value.strip('"')
    except Exception as e:
        print(f"Error reading config: {e}", file=sys.stderr)
        config = {
            'IP_RANGE': '192.168.0.0/23',
            'INTERNAL_INTERFACE': 'enp2s0'
        }
    return config

def get_bandwidth_usage():
    config = get_network_config()
    ip_range = config.get('IP_RANGE', '192.168.0.0/23')
    interface = config.get('INTERNAL_INTERFACE', 'enp2s0')
    
    cmd = [
        'iftop',
        '-n',        # Don't resolve names
        '-N',        # Don't resolve ports
        '-P',        # Show ports
        '-B',        # Show bandwidth in bytes
        '-L', ip_range,
        '-i', interface,
        '-t',        # Text output mode
        '-s', '3'    # Run for 3 seconds
    ]
    
    try:
        print(f"Running command: {' '.join(cmd)}", file=sys.stderr)
        result = subprocess.run(cmd, capture_output=True, text=True)
        output = result.stdout if result.stdout else result.stderr
        
        usage_data = {}  # Use dict to accumulate bandwidth per IP
        
        # Skip header lines
        lines = output.split('\n')
        data_lines = [line for line in lines if '=>' in line or '<=' in line]
        
        current_remote = None
        
        for line in data_lines:
            if '=>' in line:  # This is an outbound line
                parts = line.strip().split()
                current_remote = parts[1]  # Store the remote IP for the next line
            elif '<=' in line and current_remote:  # This is an inbound line
                parts = line.strip().split()
                local_ip = parts[0].strip()
                
                if not local_ip.startswith('192.168'):
                    continue
                    
                # Get the last 2s values (most current)
                values = [p for p in parts if any(unit in p for unit in ['B', 'KB', 'MB', 'GB'])]
                if len(values) >= 1:
                    download = convert_to_mbps(values[0])
                    upload = 0  # We'll get this from the other direction
                    
                    if local_ip in usage_data:
                        usage_data[local_ip]['download'] += download
                    else:
                        usage_data[local_ip] = {
                            'ip': local_ip,
                            'download': download,
                            'upload': 0,
                            'total': 0
                        }
        
        # Convert the dictionary to a list and calculate totals
        final_data = []
        for ip, data in usage_data.items():
            data['total'] = data['download'] + data['upload']
            # Format numbers to 2 decimal places
            data['download'] = f"{data['download']:.2f}"
            data['upload'] = f"{data['upload']:.2f}"
            data['total'] = f"{data['total']:.2f}"
            final_data.append(data)
        
        # Sort by total bandwidth (converted back to float for sorting)
        final_data.sort(key=lambda x: float(x['total']), reverse=True)
        
        if not final_data:
            print("Warning: No bandwidth data collected", file=sys.stderr)
            
        return {
            'status': 'success',
            'data': final_data,
            'timestamp': time.time()
        }
    except Exception as e:
        print(f"Error in get_bandwidth_usage: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'status': 'error',
            'message': str(e),
            'timestamp': time.time()
        }

def convert_to_mbps(bandwidth_str):
    """Convert bandwidth string to Mbps"""
    try:
        value = float(re.match(r'[\d.]+', bandwidth_str).group())
        unit = bandwidth_str.strip('0123456789.')
        
        if 'GB' in unit or 'Gb' in unit:
            return value * 1000
        elif 'MB' in unit or 'Mb' in unit:
            return value
        elif 'KB' in unit or 'Kb' in unit:
            return value / 1000
        else:  # bytes
            return value / 1000000
    except Exception as e:
        print(f"Error converting bandwidth: {bandwidth_str} - {str(e)}", file=sys.stderr)
        return 0

def write_cache(data):
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error writing cache: {e}", file=sys.stderr)

def handle_signal(signum, frame):
    print("Received signal to terminate. Cleaning up...", file=sys.stderr)
    try:
        Path(CACHE_FILE).unlink(missing_ok=True)
    except Exception as e:
        print(f"Error cleaning up: {e}", file=sys.stderr)
    sys.exit(0)

def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    print("Starting bandwidth monitoring daemon...", file=sys.stderr)
    
    while True:
        try:
            data = get_bandwidth_usage()
            write_cache(data)
            time.sleep(UPDATE_INTERVAL)
        except Exception as e:
            print(f"Error in main loop: {e}", file=sys.stderr)
            time.sleep(UPDATE_INTERVAL)

if __name__ == '__main__':
    main() 