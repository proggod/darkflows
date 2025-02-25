#!/usr/bin/env python3
import subprocess
import json
import re
from pathlib import Path
import time

def get_network_config():
    config = {}
    with open('/etc/darkflows/d_network.cfg', 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            if '=' in line:
                key, value = line.strip().split('=', 1)
                config[key] = value.strip('"')
    return config

def get_bandwidth_usage():
    config = get_network_config()
    ip_range = config.get('IP_RANGE', '192.168.0.0/23')
    interface = config['INTERNAL_INTERFACE']
    
    # Run iftop for 3 seconds to collect meaningful data
    cmd = [
        'sudo', 'iftop',
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
        # Run iftop and capture output
        result = subprocess.run(cmd, capture_output=True, text=True)
        output = result.stdout if result.stdout else result.stderr
        
        # Debug output
        print(f"Raw iftop output:\n{output}", file=sys.stderr)
        
        usage_data = []
        current_ip = None
        
        for line in output.split('\n'):
            # Look for lines with IP addresses and bandwidth
            ip_match = re.match(r'^\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            if ip_match:
                current_ip = ip_match.group(1)
                # Extract bandwidth values (looking for Mb, Kb, b)
                values = re.findall(r'([\d.]+(?:Mb|Kb|b))', line)
                if len(values) >= 2:
                    usage_data.append({
                        'ip': current_ip,
                        'sent': values[0],
                        'received': values[1],
                        'timestamp': time.time()
                    })
        
        return {'status': 'success', 'data': usage_data}
    except Exception as e:
        import traceback
        return {
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc()
        }

if __name__ == '__main__':
    import sys
    print(json.dumps(get_bandwidth_usage()))

