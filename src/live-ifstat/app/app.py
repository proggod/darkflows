from flask import Flask
from api.bandwidth import get_bandwidth_usage

app = Flask(__name__)

@app.route('/api/bandwidth-usage')
def bandwidth_usage():
    return get_bandwidth_usage()

# ... rest of your routes ... 