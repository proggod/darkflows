from api.bandwidth import get_bandwidth_usage

@app.route('/api/bandwidth-usage')
def bandwidth_usage():
    return get_bandwidth_usage() 