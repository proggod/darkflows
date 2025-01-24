from flask import jsonify
import subprocess
import re
import ipaddress
import json
from pathlib import Path

CACHE_FILE = '/dev/shm/bandwidth_usage.json'

def get_ip_range():
    try:
        with open('/etc/darkflows/d_network.cfg', 'r') as f:
            for line in f:
                if line.startswith('IP_RANGE='):
                    return line.split('=')[1].strip().strip('"')
    except Exception as e:
        print(f"Error reading IP range: {e}")
        return "192.168.0.0/23"  # Default fallback

def get_bandwidth_usage():
    try:
        if not Path(CACHE_FILE).exists():
            return jsonify({
                "error": "Bandwidth data not available. Monitor may not be running."
            }), 503

        with open(CACHE_FILE, 'r') as f:
            data = json.load(f)
            
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_internal_interface():
    try:
        with open('/etc/darkflows/d_network.cfg', 'r') as f:
            for line in f:
                if line.startswith('INTERNAL_INTERFACE='):
                    return line.split('=')[1].strip().strip('"')
    except Exception as e:
        print(f"Error reading internal interface: {e}")
        return "enp2s0"  # Default fallback 