from flask import jsonify
import json
from pathlib import Path

CACHE_FILE = '/dev/shm/bandwidth_usage.json'

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