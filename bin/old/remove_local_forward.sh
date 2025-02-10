#!/bin/bash
set -e

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <external_port> [local_port]"
    exit 1
fi

EXT_PORT=$1
LOCAL_PORT=${2:-$1}

echo "Removing local port forwarding $EXT_PORT -> $LOCAL_PORT"

# Delete redirect rule
nft -a list ruleset 2>/dev/null | awk -v port=$EXT_PORT -v lport=$LOCAL_PORT '
/tcp dport .* redirect to/ {
    match($0, /handle [0-9]+/)
    if (RLENGTH > 0 && $3 == port) {
        print "delete rule ip nat prerouting " substr($0, RSTART, RLENGTH)
    }
}' | while read -r cmd; do
    nft $cmd
done

# Delete input rule
nft -a list chain inet filter input 2>/dev/null | awk -v port=$EXT_PORT '
/tcp dport .* ct state/ {
    match($0, /handle [0-9]+/)
    if (RLENGTH > 0 && $3 == port) {
        print "delete rule inet filter input " substr($0, RSTART, RLENGTH)
    }
}' | while read -r cmd; do
    nft $cmd
done

echo "Successfully removed local port forward $EXT_PORT -> $LOCAL_PORT"

