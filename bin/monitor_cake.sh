k#!/bin/bash
INTERVAL=20  # seconds

while true; do
  echo ""
  echo ""
  echo ""
  echo ""
  echo "=========================== $(date) ============================"
  
  # Find all interfaces using CAKE
  CAKE_INTERFACES=$(tc qdisc show | grep cake | awk '{print $5}')
  
  if [ -z "$CAKE_INTERFACES" ]; then
    echo "No interfaces found using CAKE qdisc."
    sleep $INTERVAL
    continue
  fi
  
  # Check each interface
  for INTERFACE in $CAKE_INTERFACES; do
    echo ""
    echo "---- Interface: $INTERFACE ----"
    
    # Get tin statistics instead of using JSON parsing
    echo "Tin Statistics:"
    tc -s qdisc show dev $INTERFACE | grep -E 'Tin \d+|BULK_FLOWS|SPARSE_FLOWS|UNRESPONSIVE_FLOWS' | sed 's/^[ \t]*//'
    
    echo ""
    echo "Memory and queue stats:"
    tc -s qdisc show dev $INTERFACE | grep -E 'Sent|dropped|overlimits|memory|backlog' | sed 's/^[ \t]*//'
    tc -s class show dev $INTERFACE | grep deficit | sort -n
    echo "-------------------------------"
  done
  
  sleep $INTERVAL
done



