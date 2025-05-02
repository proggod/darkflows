#!/bin/bash
# Script to disable key hardware offloading on all interfaces

# Log file
LOG_FILE="/var/log/darkflows.log"

echo "$(date): Starting hardware offloading disabler..." | tee -a $LOG_FILE

# Get all interfaces
ALL_INTERFACES=$(ip -o link show | awk -F': ' '{print $2}')

# Skip these virtual interface prefixes
SKIP_PREFIXES="veth docker tun tap virbr wg vxlan lo dummy sit br-"

# Process each interface
for IFACE in $ALL_INTERFACES; do
    # Skip virtual interfaces
    SKIP=0
    for PREFIX in $SKIP_PREFIXES; do
        if [[ $IFACE == $PREFIX* ]]; then
            SKIP=1
            echo "$(date): Skipping virtual interface $IFACE" | tee -a $LOG_FILE
            break
        fi
    done
    
    if [ $SKIP -eq 1 ]; then
        continue
    fi
    
    # Skip VLAN interfaces (those with @ in name)
    if [[ $IFACE == *@* ]]; then
        echo "$(date): Skipping VLAN interface $IFACE" | tee -a $LOG_FILE
        continue
    fi
    
    echo "$(date): Processing interface $IFACE" | tee -a $LOG_FILE
    
    # Just try the direct command that worked
    ethtool -K $IFACE gso off gro off tso off 2>/dev/null
    
    # Check if it worked
    if ethtool -k $IFACE 2>/dev/null | grep -q "generic-segmentation-offload: off"; then
        echo "$(date): Successfully disabled key offloading features on $IFACE" | tee -a $LOG_FILE
    else
        echo "$(date): Could not disable offloading features on $IFACE" | tee -a $LOG_FILE
    fi
done

echo "$(date): Hardware offloading disabling process completed" | tee -a $LOG_FILE


