#!/bin/bash
cd /usr/local/darkflows/bin
/usr/local/darkflows/bin/setup_default_route.sh

#/usr/local/darkflows/bin/min.sh

/usr/local/darkflows/bin/nftables.sh
/usr/local/darkflows/bin/setup_secondwan.sh
/usr/local/darkflows/bin/verify_dns.sh
/usr/local/darkflows/bin/update_external_forwards.sh
/usr/local/darkflows/bin/update_local_forwards.sh
/usr/local/darkflows/bin/update_secondary_routes.sh
#/usr/local/darkflows/bin/update_dyndns.sh
/usr/local/darkflows/bin/setup_vlans.sh





#restore original in case of issue, next reboot will run fine
#rm /usr/local/darkflows/bin/nftables.sh
#cp /usr/local/darkflows/bin/nftables_man.sh /usr/local/darkflows/bin/nftables.sh
#chmod a+x /usr/local/darkflows/bin/nftables.sh


/usr/bin/screen -dmS dyndns /usr/local/darkflows/bin/update_dyndns.sh
/usr/bin/screen -dmS check_conn /usr/local/darkflows/bin/check_conn.sh 
/usr/bin/screen -dmS cake_stats /usr/local/darkflows/bin/cake_stats.sh
/usr/bin/screen -dmS ping_monitor /usr/bin/python3 /usr/local/darkflows/bin/run_ping.py
/usr/bin/screen -dmS bandwidth_monitor /usr/bin/python3 /usr/local/darkflows/bin/monitor_bandwidth.py
/usr/bin/screen -dmS unbound /usr/bin/python3 /usr/local/darkflows/bin/run_unbound.py


# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Wait for Docker to be fully ready (max 5 minutes)
echo "Waiting for Docker service..."
max_wait=300
wait_time=0
while ! docker info >/dev/null 2>&1; do
    if [ $wait_time -ge $max_wait ]; then
        echo "Timeout waiting for Docker service."
        exit 1
    fi
    sleep 5
    wait_time=$((wait_time + 5))
done

# Additional check for docker commands
while ! docker ps >/dev/null 2>&1; do
    if [ $wait_time -ge $max_wait ]; then
        echo "Timeout waiting for Docker to respond to commands."
        exit 1
    fi
    sleep 5
    wait_time=$((wait_time + 5))
done

echo "Docker is ready"

# Now you can run your route_docker.sh script


/usr/local/darkflows/bin/route_docker.sh -f /etc/darkflows/route_docker.txt 









