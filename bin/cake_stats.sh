#!/bin/bash
# ============================================
# Network Interface Monitoring Script
# ============================================
# This script monitors network interfaces using `tc` and applies qdisc settings.
# It tracks packet drops, backlog, and memory usage, providing warnings when thresholds are exceeded.
# Additionally, it outputs the metrics as JSON to an in-memory file system for web-based monitoring systems.
#
# Features:
# - Configurable DEBUG mode to enable or disable debug prints.
# - Robust parsing to handle multiple `(dropped X,)` entries.
# - Proper error handling and logging.
# - JSON output stored in RAM to minimize disk wear.
#
# Author: Your Name
# Date: YYYY-MM-DD
# ============================================

# ----------------------------
# Configuration Variables
# ----------------------------

# Toggle DEBUG mode: set to "true" to enable debug prints, "false" to disable.
DEBUG=true

# Path to the JSON output file in tmpfs (RAM)
OUTPUT_FILE="/dev/shm/status.json"

# Configuration file path
CONFIG_FILE="/etc/darkflows/d_network.cfg"

# Thresholds for notifications (adjust as needed)
MAX_DROPS=50                   # Maximum allowable drops over the monitoring window
MAX_BACKLOG=0                  # Maximum allowable backlog in bytes
MAX_MEMORY_USAGE=$((32 * 1024 * 1024))  # Maximum memory usage (in bytes), default 32MB

# Sleep interval between updates (in seconds)
SLEEP_INTERVAL=15

# Number of samples to consider for the monitoring window
MONITOR_WINDOW=20

# ----------------------------
# Function Definitions
# ----------------------------

# Function to handle debug logging
log_debug() {
  if [ "$DEBUG" = true ]; then
    echo "DEBUG: $1"
  fi
}

# Function to get the current bandwidth of ifb0
get_ifb0_bandwidth() {
  tc qdisc show dev ifb0 | grep -oP 'bandwidth \K[^\s]+' | head -n1
}

# Function to reset qdisc for egress (outgoing traffic)
reset_egress() {
  local iface=$1
  local egress_bw=$2

  log_debug "Applying bandwidth $egress_bw to $iface"

  if [[ -n "$egress_bw" ]]; then
    echo "Resetting CAKE qdisc for egress on $iface..."
    tc qdisc del dev "$iface" root 2>/dev/null || true
    tc qdisc add dev "$iface" root cake \
      bandwidth "$egress_bw" \
      memlimit 32mb \
      diffserv4 \
      rtt 50ms \
      triple-isolate \
      no-ack-filter
  fi
}

# Function to reset qdisc for ingress (incoming traffic)
reset_ingress() {
  local iface=$1
  local ingress_bw=$2

  if [[ "$iface" != "ifb0" ]]; then
    echo "Resetting CAKE qdisc for ingress on $iface using IFB..."
    tc qdisc del dev "$iface" ingress 2>/dev/null || true
    tc qdisc add dev "$iface" ingress
    tc filter add dev "$iface" parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0
  fi

  # Only reset ifb0 once
  if [[ "$ifb0_initialized" -eq 0 ]]; then
    local current_ifb0_bw
    current_ifb0_bw=$(get_ifb0_bandwidth)
    if [[ -z "$current_ifb0_bw" ]]; then
      current_ifb0_bw="$ingress_bw"
    fi

    echo "Setting ifb0 bandwidth to $current_ifb0_bw..."
    tc qdisc del dev ifb0 root 2>/dev/null || true
    tc qdisc add dev ifb0 root cake \
      bandwidth "$current_ifb0_bw" \
      memlimit 32mb \
      diffserv4 \
      rtt 50ms \
      triple-isolate \
      no-ack-filter
    ifb0_initialized=1
  fi
}

# Function to update the drop history and calculate new_drops
update_drop_history() {
  local iface=$1
  local current_cumulative_drops=$2

  # Split the current history into an array
  IFS=',' read -r -a history <<< "${drop_history["$iface"]}"

  # Add the current cumulative drops
  history+=("$current_cumulative_drops")

  # Trim the history to the monitoring window
  if (( ${#history[@]} > MONITOR_WINDOW )); then
    history=("${history[@]:1}")
  fi

  # Update the drop history
  drop_history["$iface"]=$(IFS=,; echo "${history[*]}")

  # Calculate new_drops as current - drops MONITOR_WINDOW samples ago
  if (( ${#history[@]} >= MONITOR_WINDOW )); then
    local old_cumulative_drops="${history[0]}"
    new_drops=$((current_cumulative_drops - old_cumulative_drops))

    # Ensure new_drops is non-negative
    if (( new_drops < 0 )); then
      new_drops=0
      log_debug "new_drops was negative for interface '$iface'. Resetting to 0."
    fi
  else
    # Not enough samples yet
    new_drops=0
  fi

  # Update total_drops with the new_drops value
  total_drops["$iface"]="$new_drops"

  log_debug "Calculated new_drops for '$iface': $new_drops (current: $current_cumulative_drops, old: ${history[0]})"
}

# Function to generate JSON output
generate_json() {
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  log_debug "Generated JSON ================================================>"

  # Start JSON structure
  {
    echo "{"
    echo "  \"timestamp\": \"$timestamp\","
    echo "  \"interfaces\": {"

    local iface
    local first_iface=true
    for iface in "${interfaces[@]}"; do
      # Handle comma separation
      if [ "$first_iface" = true ]; then
        first_iface=false
      else
        echo ","
      fi

      # Retrieve metrics
      local drops="${total_drops["$iface"]}"
      local backlog="${current_backlog["$iface"]:-0}"
      local memory="${current_memory["$iface"]:-0}"

      # Construct JSON for the interface
      echo "    \"$iface\": {"
      echo "      \"new_drops\": $drops,"
      echo "      \"backlog\": $backlog,"
      echo "      \"memory\": $memory"
      echo -n "    }"
    done

    echo ""
    echo "  }"
    echo "}"
  } > /tmp/status.json.tmp

  # Move temporary JSON to the output file atomically
  mv /tmp/status.json.tmp "$OUTPUT_FILE"

  # Set appropriate permissions
  chmod 644 "$OUTPUT_FILE"

  log_debug "Generated JSON output at '$OUTPUT_FILE'"
}

# Function to check the interface status
check_interface() {
  local iface=$1
  local egress_bw=$2
  local ingress_bw=$3

  # Reset qdisc on the first run
  if (( initialized["$iface"] == 0 )); then
    reset_egress "$iface" "$egress_bw"
    reset_ingress "$iface" "$ingress_bw"
    initialized["$iface"]=1
    echo "Interface: $iface"
    echo "  [INFO] CAKE qdisc reset. Monitoring starts now."
    echo ""
    return
  fi

  # Capture the output of `tc`
  output=$(tc -s qdisc show dev "$iface")

  # Extract relevant metrics with fallbacks to 0
  current_cumulative_drops=$(echo "$output" | grep -Po '(?<=\(dropped )\d+(?=,)' | head -n1 || echo "0")
  backlog=$(echo "$output" | grep -Po 'backlog \K[0-9]+b' | sed 's/b//' | head -n1 || echo "0")
  memory=$(echo "$output" | grep -Po 'memory used: \K[0-9]+' | head -n1 || echo "0")

  # Store current backlog and memory for JSON output
  current_backlog["$iface"]="$backlog"
  current_memory["$iface"]="$memory"

  log_debug "drop_history[$iface] = '${drop_history["$iface"]}'"

  # Update drop history and calculate new_drops
  update_drop_history "$iface" "$current_cumulative_drops"

  # Display the interface being checked and the live metrics
  echo "Interface: $iface"
  echo "  New Drops: ${total_drops["$iface"]}"
  echo "  Drop Rate Over Last $MONITOR_WINDOW Updates: ${total_drops["$iface"]} (Threshold: $MAX_DROPS)"
  echo "  Backlog: $backlog bytes (Threshold: $MAX_BACKLOG bytes)"
  echo "  Memory: $memory bytes (Threshold: $MAX_MEMORY_USAGE bytes)"

  # Check for issues and display warnings
  if (( total_drops["$iface"] > MAX_DROPS )); then
    echo "  [WARNING] Drops over the last $MONITOR_WINDOW updates exceeded threshold!"
  fi
  if (( backlog > MAX_BACKLOG )); then
    echo "  [WARNING] Backlog exceeded threshold!"
  fi
  if (( memory > MAX_MEMORY_USAGE )); then
    echo "  [WARNING] Memory usage exceeded threshold!"
  fi
  echo ""
}

# ----------------------------
# Script Initialization
# ----------------------------

# Check if the configuration file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Configuration file '$CONFIG_FILE' not found."
  echo "Please ensure the file exists and contains the necessary settings."
  exit 1
fi

# Load network configuration
source "$CONFIG_FILE"

# Define interfaces and their corresponding bandwidth settings from the config
interfaces=("$PRIMARY_INTERFACE" "$INTERNAL_INTERFACE" "ifb0")
egress_bandwidths=("$PRIMARY_EGRESS_BANDWIDTH" "$INTERNAL_EGRESS_BANDWIDTH" "")
ingress_bandwidths=("$PRIMARY_INGRESS_BANDWIDTH" "$INTERNAL_INGRESS_BANDWIDTH" "500mbit") # Default ingress bandwidth for ifb0

# Add secondary interface if it is set
if [ -n "$SECONDARY_INTERFACE" ]; then
  interfaces+=("$SECONDARY_INTERFACE")
  egress_bandwidths+=("$SECONDARY_EGRESS_BANDWIDTH")
  ingress_bandwidths+=("$SECONDARY_INGRESS_BANDWIDTH")
fi

# Declare associative arrays to track drop history, totals, and current metrics
declare -A drop_history
declare -A total_drops
declare -A initialized
declare -A current_backlog
declare -A current_memory

# Initialize history arrays and flags for each interface
for iface in "${interfaces[@]}"; do
  drop_history["$iface"]="0"  # Initial cumulative drop count
  total_drops["$iface"]=0     # Initialize total_drops
  initialized["$iface"]=0     # Flag to indicate if the counter has been reset
done

# Flag to track if ifb0 has been reset
ifb0_initialized=0

# ----------------------------
# Main Monitoring Loop
# ----------------------------

while true; do
  clear  # Clear the screen for live updates
  echo "=== Monitoring TC Stats ==="
  echo "Timestamp: $(date)"
  echo ""

  # Monitor each interface with specific bandwidth settings
  for i in "${!interfaces[@]}"; do
    check_interface "${interfaces[$i]}" "${egress_bandwidths[$i]}" "${ingress_bandwidths[$i]}"
  done

  # Generate JSON output after checking all interfaces
  generate_json

  # Wait for the specified interval before the next update
  sleep "$SLEEP_INTERVAL"
done

