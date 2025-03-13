#!/bin/bash
cd /usr/local/darkflows/bin
python3 /usr/local/darkflows/bin/verify_configs.py
/usr/local/darkflows/bin/setup_default_route.sh


/usr/local/darkflows/bin/nftables.sh
/usr/local/darkflows/bin/setup_vlans.sh
/usr/local/darkflows/bin/setup_secondwan.sh
/usr/local/darkflows/bin/verify_dns.sh
/usr/local/darkflows/bin/update_external_forwards.sh
/usr/local/darkflows/bin/update_local_forwards.sh
/usr/local/darkflows/bin/update_secondary_routes.sh
#/usr/local/darkflows/bin/wifi-routing.sh


/usr/bin/screen -dmS dyndns /usr/local/darkflows/bin/update_dyndns.sh
/usr/bin/screen -dmS check_conn /usr/local/darkflows/bin/check_conn.sh 
/usr/bin/screen -dmS cake_stats /usr/local/darkflows/bin/cake_stats.sh
/usr/bin/screen -dmS ping_monitor /usr/bin/python3 /usr/local/darkflows/bin/run_ping.py
/usr/bin/screen -dmS bandwidth_monitor /usr/bin/python3 /usr/local/darkflows/bin/monitor_bandwidth.py
/usr/bin/screen /usr/bin/python3 /usr/local/darkflows/bin/run_all_unbounds.py


#/usr/local/darkflows/bin/update_dyndns.sh









