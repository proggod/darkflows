#!/bin/bash

# Set shell to continue on errors
set +e

# Function to run command and log any failures
run_cmd() {
    echo "Running: $1"
    $1
    if [ $? -ne 0 ]; then
        echo "WARNING: Command failed: $1"
    fi
}

cd /usr/local/darkflows/bin

run_cmd "python3 /usr/local/darkflows/bin/verify_configs.py"
run_cmd "/usr/local/darkflows/bin/setup_default_route.sh"

run_cmd "/usr/local/darkflows/bin/nftables.sh"
run_cmd "/usr/local/darkflows/bin/setup_vlans.sh"
run_cmd "/usr/local/darkflows/bin/setup_secondwan.sh"
run_cmd "/usr/local/darkflows/bin/verify_dns.sh"
run_cmd "/usr/local/darkflows/bin/update_external_forwards.sh"
run_cmd "/usr/local/darkflows/bin/update_local_forwards.sh"
run_cmd "/usr/local/darkflows/bin/update_secondary_routes.sh"
#run_cmd "/usr/local/darkflows/bin/wifi-routing.sh"

# Start background processes with screen
run_cmd "/usr/bin/screen -dmS dyndns /usr/local/darkflows/bin/update_dyndns.sh"
run_cmd "/usr/bin/screen -dmS check_conn /usr/local/darkflows/bin/check_conn.sh"
run_cmd "/usr/bin/screen -dmS cake_stats /usr/local/darkflows/bin/cake_stats.sh"
run_cmd "/usr/bin/screen -dmS ping_monitor /usr/bin/python3 /usr/local/darkflows/bin/run_ping.py"
run_cmd "/usr/bin/screen -dmS bandwidth_monitor /usr/bin/python3 /usr/local/darkflows/bin/monitor_bandwidth.py"
run_cmd "/usr/bin/screen /usr/bin/python3 /usr/local/darkflows/bin/run_all_unbounds.py"
run_cmd "/usr/bin/python3 /usr/local/darkflows/bin/verify_blocklists.py"

#run_cmd "/usr/local/darkflows/bin/update_dyndns.sh"

echo "Setup completed with all steps attempted"









