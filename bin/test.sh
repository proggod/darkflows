#!/bin/bash
# Advanced QoS Script for Low-Latency Gaming and Buffer Bloat Prevention

# Source network configuration
source /etc/darkflows/d_network.cfg || { echo "Failed to source network configuration"; exit 1; }

# Preset Configurations for Low-Latency Gaming
# Format: [Description] [Ingress Params] [Egress Params]
# Preset Configurations with Burst Options
PRESET_1=(
    "Ultra-Low Latency Gaming"
    "target 1ms interval 5ms flows 128 noecn quantum 100 limit 512"
    "target 2ms interval 10ms flows 64 noecn quantum 50 limit 256"
)

PRESET_2=(
    "Balanced Performance"
    "target 3ms interval 15ms flows 256 ecn quantum 200 limit 1024 burst 256K"
    "target 5ms interval 20ms flows 128 ecn quantum 100 limit 512 burst 128K"
)

PRESET_3=(
    "Aggressive Latency Reduction"
    "target 1ms interval 5ms flows 64 ce_threshold 3ms noecn limit 256 "
    "target 2ms interval 10ms flows 32 ce_threshold 5ms noecn limit 128 "
)

PRESET_4=(
    "Conservative Gaming"
    "target 5ms interval 20ms flows 512 ecn quantum 300 limit 2048 "
    "target 8ms interval 30ms flows 256 ecn quantum 150 limit 1024 "
)

PRESET_5=(
    "High Responsiveness"
    "target 2ms interval 10ms flows 128 noecn quantum 150 limit 512 "
    "target 3ms interval 15ms flows 64 noecn quantum 75 limit 256 "
)

PRESET_6=(
    "ECN Congestion Management"
    "target 4ms interval 20ms flows 256 ecn quantum 200 ce_threshold 10ms limit 1024 burst 256K"
    "target 6ms interval 25ms flows 128 ecn quantum 100 ce_threshold 15ms limit 512 burst 128K"
)

PRESET_7=(
    "Minimal Queue Depth"
    "target 3ms interval 15ms flows 64 noecn quantum 100 limit 256 "
    "target 5ms interval 20ms flows 32 noecn quantum 50 limit 128 "
)

PRESET_8=(
    "Adaptive Flow Control"
    "target 2ms interval 10ms flows 256 ecn quantum 200 ce_threshold 5ms limit 1024 burst 256K"
    "target 4ms interval 15ms flows 128 ecn quantum 100 ce_threshold 10ms limit 512 burst 128K"
)

PRESET_9=(
    "Strict Latency Enforcement"
    "target 1ms interval 5ms flows 32 noecn quantum 50 limit 128 ce_threshold 2ms "
    "target 2ms interval 10ms flows 16 noecn quantum 25 limit 64 ce_threshold 3ms "
)

PRESET_10=(
    "High Download Performance"
    "target 10ms interval 50ms flows 1024 ecn quantum 500 limit 4096 burst 1M"
    "target 15ms interval 75ms flows 512 ecn quantum 250 limit 2048 burst 512K"
)

# Default preset
DEFAULT_PRESET=5


# Bandwidth Configuration
INGRESS_BANDWIDTH="800Mbit"
EGRESS_BANDWIDTH="30Mbit"

# Function to update QoS settings
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
    echo "  Bandwidth: $INGRESS_BANDWIDTH"
    echo "  Parameters: $INGRESS_PARAMS"
    
    # Create HTB root qdisc with precise bandwidth control
    tc qdisc add dev ifb0 root handle 1: htb default 1
    tc class add dev ifb0 parent 1: classid 1:1 htb rate $INGRESS_BANDWIDTH ceil $INGRESS_BANDWIDTH
    
    # Add fq_codel with specific parameters from preset
    tc qdisc add dev ifb0 parent 1:1 fq_codel $INGRESS_PARAMS || {
        echo "Failed to configure ingress QoS";
        exit 1;
    }

    # Configure egress (upload) on primary interface
    echo "Configuring egress on $PRIMARY_INTERFACE:"
    echo "  Bandwidth: $EGRESS_BANDWIDTH"
    echo "  Parameters: $EGRESS_PARAMS"
    
    # Create HTB root qdisc with precise bandwidth control
    tc qdisc add dev $PRIMARY_INTERFACE root handle 1: htb default 1
    tc class add dev $PRIMARY_INTERFACE parent 1: classid 1:1 htb rate $EGRESS_BANDWIDTH ceil $EGRESS_BANDWIDTH
    
    # Add fq_codel with specific parameters from preset
    tc qdisc add dev $PRIMARY_INTERFACE parent 1:1 fq_codel $EGRESS_PARAMS || {
        echo "Failed to configure egress QoS";
        exit 1;
    }

    # Detailed verification
    echo "Verifying Bandwidth Limits and QoS Parameters:"
    echo "Ingress (ifb0):"
    tc class show dev ifb0
    tc qdisc show dev ifb0
    echo "Egress ($PRIMARY_INTERFACE):"
    tc class show dev $PRIMARY_INTERFACE
    tc qdisc show dev $PRIMARY_INTERFACE
}

# Display presets function
display_presets() {
    echo "Low-Latency Gaming QoS Presets:"
    for i in {1..10}; do
        preset_var="PRESET_${i}[0]"
        echo "  $i: ${!preset_var}"
    done
    echo ""
    echo "Usage: $0 [preset_number]"
    echo "  - Applies both ingress and egress QoS settings"
    echo "  - Focused on reducing latency for gaming"
}

# Main script logic
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    display_presets
    exit 0
fi

# Determine which preset to use
PRESET_NUM=$DEFAULT_PRESET
if [[ -n "$1" && "$1" =~ ^[0-9]+$ ]]; then
    if [[ "$1" -ge 1 && "$1" -le 10 ]]; then
        PRESET_NUM=$1
        shift
    else
        echo "Invalid preset number. Please choose a number between 1 and 10."
        display_presets
        exit 1
    fi
fi

# Get preset configuration
PRESET_NAME="PRESET_${PRESET_NUM}[0]"
PRESET_INGRESS="PRESET_${PRESET_NUM}[1]"
PRESET_EGRESS="PRESET_${PRESET_NUM}[2]"

echo "Applying QoS Preset $PRESET_NUM: ${!PRESET_NAME}"
echo "Ingress Parameters: ${!PRESET_INGRESS}"
echo "Egress Parameters: ${!PRESET_EGRESS}"

# Apply QoS settings
update_qos_settings "${!PRESET_INGRESS}" "${!PRESET_EGRESS}"

# Verify configuration
echo "### Verifying QoS Configuration ###"
tc -s qdisc show dev $PRIMARY_INTERFACE
tc -s qdisc show dev ifb0

echo "QoS configuration applied successfully."



