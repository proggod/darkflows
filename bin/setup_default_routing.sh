#!/bin/bash

/usr/local/darkflows/bin/setup_default_route.sh

/usr/local/darkflows/bin/min.sh

/usr/local/darkflows/bin/nftables.sh

#restore original in case of issue, next reboot will run fine
#rm /usr/local/darkflows/bin/nftables.sh
#cp /usr/local/darkflows/bin/nftables_man.sh /usr/local/darkflows/bin/nftables.sh
#chmod a+x /usr/local/darkflows/bin/nftables.sh


/usr/bin/screen -dmS dyndns /usr/local/darkflows/bin/update_dyndns.sh
/usr/bin/screen -dmS check_conn /usr/local/darkflows/bin/check_conn.sh 
/usr/bin/screen -dmS cake_stats /usr/local/darkflows/bin/cake_stats.sh
/usr/bin/screen -dmS ping_monitor /usr/bin/python3 /usr/local/darkflows/bin/run_ping.py








#echo "Current nftables rules:"
#nft list ruleset
#echo "Current nftables mangle table:"
#nft list table ip mangle




