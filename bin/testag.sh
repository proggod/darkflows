#!/bin/bash
# Advanced Anti-Buffer Bloat QoS Script

# Source network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Bandwidth Configuration
INGRESS_BANDWIDTH="400Mbit"
EGRESS_BANDWIDTH="15Mbit"

update_qos_settings() {
    local INGRESS_PARAMS="$1"
    local EGRESS_PARAMS="$2"

    # Clear existing qdiscs
    tc qdisc del dev $PRIMARY_INTERFACE ingress 2>/dev/null || true
    tc qdisc del dev $PRIMARY_INTERFACE root 2>/dev/null || true
    tc qdisc del dev ifb0 root 2>/dev/null || true

    # Recreate ingress setup
    tc qdisc add dev $PRIMARY_INTERFACE handle ffff: ingress || { 
        echo "Failed to add ingress qdisc"; 
        exit 1; 
    }
    tc filter add dev $PRIMARY_INTERFACE parent ffff: protocol all u32 match u32 0 0 action mirred egress redirect dev ifb0 || { 
        echo "Failed to add redirect filter"; 
        exit 1; 
    }

    # Configure ingress (download) on ifb0
    echo "Configuring ingress on ifb0:"
    tc qdisc add dev ifb0 root handle 1: htb default 1
    tc class add dev ifb0 parent 1: classid 1:1 htb rate $INGRESS_BANDWIDTH ceil $INGRESS_BANDWIDTH

    # Aggressive fq_codel configuration for ingress
    tc qdisc add dev ifb0 parent 1:1 fq_codel \
        limit 100 \
        flows 1024 \
        target 1ms \
        interval 5ms \
        quantum 300 \
        ce_threshold 1ms \
        ecn \
        || {
        echo "Failed to configure ingress QoS";
        exit 1;
    }

    # Configure egress (upload) on primary interface
    echo "Configuring egress on $PRIMARY_INTERFACE:"
    tc qdisc add dev $PRIMARY_INTERFACE root handle 1: htb default 1
    tc class add dev $PRIMARY_INTERFACE parent 1: classid 1:1 htb rate $EGRESS_BANDWIDTH ceil $EGRESS_BANDWIDTH

    # Aggressive fq_codel configuration for egress
    tc qdisc add dev $PRIMARY_INTERFACE parent 1:1 fq_codel \
        limit 100 \
        flows 512 \
        target 2ms \
        interval 10ms \
        quantum 150 \
        ce_threshold 2ms \
        ecn \
        || {
        echo "Failed to configure egress QoS";
        exit 1;
    }

    # Kernel settings to further reduce bufferbloat
    sysctl -w net.ipv4.tcp_ecn=1
    sysctl -w net.ipv4.tcp_slow_start_after_idle=0
    sysctl -w net.ipv4.tcp_window_scaling=1
    sysctl -w net.core.default_qdisc=fq_codel

    # Verify configuration
    echo "Verifying Bandwidth Limits:"
    tc -s qdisc show dev ifb0
    tc -s qdisc show dev $PRIMARY_INTERFACE
}

# Rest of the script remains the same as previous versions


