#!/bin/bash

# ==========================
# Intelligent WAN Monitoring and Failover Script
# ==========================

# Configuration File Path
CONFIG_FILE="/etc/darkflows/d_network.cfg"


# Ping thresholds and interval
PING_COUNT=5
PING_TIMEOUT=1
CHECK_INTERVAL=30

# Stability thresholds
PRIMARY_STABILITY_THRESHOLD=3  # Number of consecutive successful checks before switching back
primary_stability_counter=0    # Counter for tracking consecutive successful primary checks

# Log files
LOG_FILE="/var/log/wann-monitor.log"
NOTIFICATION_LOG_FILE="/var/log/wann-notifications.log" # For specific notifications

# Initialize current_interface variable
current_interface=""  # Will be set after sourcing config

# Function to log messages to both console and main log file
log() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" | tee -a "$LOG_FILE"
}

# NEW: Function to send notifications
send_notification() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - NOTIFICATION: $message" | tee -a "$NOTIFICATION_LOG_FILE"
    # Also log to main log for context
    log "NOTIFICATION: $message"
    # In a real-world scenario, you might add commands here to send an email, push notification, etc.
    # Example: mail -s "WAN Alert" admin@example.com <<< "$message"
}


# Function to load configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        log "Configuration loaded from $CONFIG_FILE."
    else
        log "Error: Configuration file $CONFIG_FILE not found."
        send_notification "CRITICAL ERROR: Configuration file $CONFIG_FILE not found. Script cannot run."
        exit 1
    fi
}

# Function to validate configuration variables
validate_config() {
    if [[ -z "$PRIMARY_INTERFACE" || -z "$PRIMARY_EGRESS_BANDWIDTH" || -z "$PRIMARY_INGRESS_BANDWIDTH" ]]; then
        log "Error: Incomplete Primary Interface configuration."
        send_notification "CRITICAL ERROR: Incomplete Primary Interface configuration."
        exit 1
    fi
    if [[ -n "$SECONDARY_INTERFACE" ]]; then
        if [[ -z "$SECONDARY_EGRESS_BANDWIDTH" || -z "$SECONDARY_INGRESS_BANDWIDTH" ]]; then
            log "Error: Incomplete Secondary Interface configuration for $SECONDARY_INTERFACE."
            send_notification "CRITICAL ERROR: Incomplete Secondary Interface configuration for $SECONDARY_INTERFACE."
            exit 1
        fi
    fi
}

# Function to check if an interface has an IP address
interface_has_ip() {
    local iface="$1"
    if [[ -z "$iface" ]]; then return 1; fi
    if ip addr show dev "$iface" 2>/dev/null | grep -q "inet "; then
        return 0
    else
        # Logged by caller if it's an issue
        return 1
    fi
}

# Function to extract gateway from lease file
get_gateway() {
    local lease_file="$1"
    local iface_for_lease="$2"

    if ! interface_has_ip "$iface_for_lease"; then
        # Do not log here, caller will handle/log based on context
        echo ""
        return
    fi

    if [[ -f "$lease_file" ]]; then
        grep 'option routers' "$lease_file" | tail -1 | awk '{print $3}' | tr -d ';'
    else
        echo ""
    fi
}

# Function to check if a default route exists
default_route_exists() {
    ip route | grep -q '^default'
}

# Function to test if an IP is reachable through a specific interface (uses ping -I)
test_ip_via_interface() {
    local ip="$1"
    local interface="$2"
    local count="${3:-3}"
    local timeout="${4:-2}"

    if ! interface_has_ip "$interface"; then
        log "Cannot test IP $ip via $interface: interface has no IP."
        return 1
    fi
    
    # log "Testing reachability of $ip via interface $interface (using ping -I)..." # Too verbose for every call
    ping -c "$count" -W "$timeout" -I "$interface" "$ip" > /dev/null 2>&1
    # Return status is used by caller
    return $?
}

# Function to run a comprehensive connectivity test (uses ping -I)
comprehensive_connectivity_test() {
    local interface="$1"
    local monitor1="$2" 
    local monitor2="$3" 
    
    log "Running comprehensive connectivity test on $interface..."

    if ! interface_has_ip "$interface"; then
        log "Comprehensive test aborted for $interface: interface has no IP."
        send_notification "ALERT: Comprehensive test for $interface aborted: interface has no IP."
        return 1
    fi

    if ! test_ip_via_interface "$monitor1" "$interface" 8 2; then
        log "Comprehensive test failed: Cannot reach $monitor1 via $interface"
        return 1
    fi
    
#    if ! test_ip_via_interface "$monitor2" "$interface" 8 2; then
#        log "Comprehensive test failed: Cannot reach $monitor2 via $interface"
#        return 1
#    fi
    
#    if ! test_ip_via_interface "google.com" "$interface" 5 2; then # google.com also tests DNS
#        log "Comprehensive test failed: Cannot reach google.com via $interface"
#        return 1
#    fi
    
    log "Comprehensive connectivity test PASSED on $interface."
    return 0
}

# Function to ensure route exists for monitoring IP (sets route entry)
ensure_monitoring_route() {
    local monitor_ip="$1"
    local gateway="$2"
    local interface="$3"
    
    if ! interface_has_ip "$interface"; then
        log "Cannot ensure route for $monitor_ip via $interface: interface has no IP."
        return 1
    fi
    if [[ -z "$gateway" ]]; then
        log "Warning: Gateway for $interface is not known. Cannot ensure route for $monitor_ip."
        return 1
    fi
    
    # log "Checking/Setting route to $monitor_ip via $gateway dev $interface..." # Can be verbose
    if ! ip route get "$monitor_ip" 2>/dev/null | grep -qE "dev $interface\s+via $gateway\s*|via $gateway\s+dev $interface\s*"; then
        # log "Route for $monitor_ip via $interface (gw $gateway) is missing or incorrect. Setting..." # Verbose
        if ip route replace "$monitor_ip" via "$gateway" dev "$interface"; then
            log "Route for $monitor_ip via $interface (gw $gateway) set/repaired."
        else
            log "Failed to set route for $monitor_ip via $interface (gw $gateway)."
            return 1
        fi
    # else
        # log "Route for $monitor_ip via $interface (gw $gateway) is already correct." # Verbose
    fi
    return 0
}

# Function to clean up duplicate default routes
clean_default_routes() {
    local prim_gw="$1"; local prim_if="$2"; local sec_gw="$3"; local sec_if="$4"
    local default_route_count=$(ip route | grep -c '^default')
    if [[ $default_route_count -le 1 ]]; then return 0; fi # No action if 0 or 1 default route
    
    log "Multiple default routes detected ($default_route_count). Cleaning up..."
    local active_gw=""; local active_if=""

    if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]]; then
        active_gw="$prim_gw"; active_if="$prim_if"
    elif [[ "$current_interface" == "$SECONDARY_INTERFACE" ]] && [[ -n "$SECONDARY_INTERFACE" ]]; then
        active_gw="$sec_gw"; active_if="$sec_if"
    else # Fallback if current_interface is not set or unknown
        log "Warning: Current active interface ($current_interface) unknown for default route cleanup. Using lowest metric route."
         local main_default_route=$(ip route | grep '^default' | sort -k8,8n | head -1)
         if [[ -n "$main_default_route" ]]; then
            active_gw=$(echo "$main_default_route" | awk '{print $3}')
            active_if=$(echo "$main_default_route" | awk '{print $5}')
         else
            log "Error: Could not identify any main default route for cleanup."; return 1
         fi
    fi
    
    if [[ -z "$active_gw" || -z "$active_if" ]]; then
        log "Error: Cannot determine active gateway/interface for default route cleanup. Expected GW for $current_interface may be missing."
        return 1
    fi
    log "Expected active default route via $active_gw dev $active_if."
    
    local routes_removed=0
    ip route | grep '^default' | while read -r route_entry; do
        local route_gw_entry=$(echo "$route_entry" | awk '{print $3}')
        local route_dev_entry=$(echo "$route_entry" | awk '{print $5}')
        if [[ "$route_gw_entry" != "$active_gw" || "$route_dev_entry" != "$active_if" ]]; then
            log "Removing extra/incorrect default route: $route_entry"
            if ip route del $route_entry; then routes_removed=$((routes_removed + 1)); else log "Failed to remove route: $route_entry"; fi
        fi
    done
    log "$routes_removed extra default route(s) processed for removal."
}

# Function to configure ifb0 for ingress traffic shaping
update_ifb0() {
    local old_interface="$1"; local new_interface="$2"; local ingress_bandwidth="$3"
    log "Reconfiguring CAKE ingress for switch from $old_interface to $new_interface..."
    tc qdisc del dev ifb0 root > /dev/null 2>&1 || true
    if [[ -n "$old_interface" ]]; then tc qdisc del dev "$old_interface" ingress > /dev/null 2>&1 || true; fi
    tc qdisc del dev "$new_interface" ingress > /dev/null 2>&1 || true
    tc qdisc add dev "$new_interface" handle ffff: ingress
    tc filter replace dev "$new_interface" parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0
    tc qdisc add dev ifb0 root cake bandwidth "$ingress_bandwidth" $CAKE_PARAMS
    log "CAKE ingress reconfigured for $new_interface with params: $CAKE_PARAMS"
}

# Function to configure CAKE for egress traffic
configure_cake_egress() {
    local interface="$1"; local bandwidth="$2"
    log "Configuring CAKE egress for $interface with bandwidth $bandwidth..."
    tc qdisc del dev "$interface" root > /dev/null 2>&1 || true
    tc qdisc add dev "$interface" root cake bandwidth "$bandwidth" $CAKE_PARAMS
    log "CAKE egress configured for $interface with params: $CAKE_PARAMS"
}

# Function to switch default route atomically and update monitoring routes
switch_to_interface() {
    local new_interface="$1"; local gateway="$2"; local new_bandwidth="$3"; local new_ingress_bandwidth="$4"
    log "Attempting to switch to gateway $gateway on $new_interface..."
    if ! interface_has_ip "$new_interface"; then log "Switch aborted: $new_interface has no IP."; send_notification "ALERT: Switch to $new_interface aborted: interface has no IP."; return 1; fi
    if [[ -z "$gateway" ]]; then log "Error: Gateway for $new_interface not known. Switch aborted."; send_notification "ALERT: Switch to $new_interface aborted: Gateway unknown."; return 1; fi

    if ! test_ip_via_interface "$gateway" "$new_interface" 3 2; then
        log "Error: Gateway $gateway is not reachable via $new_interface. Switch aborted."
        return 1
    fi
    
    log "Gateway $gateway is reachable. Proceeding with switch to $new_interface."
    local old_current_interface="$current_interface" 

    if ip route replace default via "$gateway" dev "$new_interface"; then
        log "Default route successfully switched to $new_interface via $gateway."
        current_interface="$new_interface" 
        
        if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]]; then
            ensure_monitoring_route "$ADDITIONAL_MONITOR" "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE"
        elif [[ "$current_interface" == "$SECONDARY_INTERFACE" ]]; then
            ensure_monitoring_route "$ADDITIONAL_MONITOR" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
        fi
        
        update_ifb0 "$old_current_interface" "$new_interface" "$new_ingress_bandwidth"
        configure_cake_egress "$new_interface" "$new_bandwidth"
        clean_default_routes "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
    else
        log "Error: Failed to switch default route to $new_interface via $gateway."
        send_notification "ERROR: Failed to switch default route to $new_interface."
    fi
}

# Function to reset the default route to a specific gateway
reset_default_route() {
    local gateway="$1"; local interface="$2"; local egress_bandwidth="$3"; local ingress_bandwidth="$4"
    log "Attempting to reset default route to $gateway on $interface..."
    if ! interface_has_ip "$interface"; then log "Reset default route aborted: $interface has no IP."; return 1; fi
    if [[ -z "$gateway" ]]; then log "Error: Gateway for $interface not known. Reset aborted."; return 1; fi

    if ! test_ip_via_interface "$gateway" "$interface" 3 2; then
        log "Error: Gateway $gateway not reachable via $interface. Cannot reset default route."
        return 1
    fi

    log "Gateway $gateway is reachable. Proceeding to reset default route on $interface."
    local old_current_interface="$current_interface" 

    if ip route replace default via "$gateway" dev "$interface"; then
        log "Default route successfully reset to $interface via $gateway."
        current_interface="$interface" 
        
        if [[ "$interface" == "$PRIMARY_INTERFACE" ]]; then
            ensure_monitoring_route "$ADDITIONAL_MONITOR" "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE"
        elif [[ "$interface" == "$SECONDARY_INTERFACE" ]]; then
            ensure_monitoring_route "$ADDITIONAL_MONITOR" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
        fi
        
        if [[ "$old_current_interface" != "$interface" || -z "$old_current_interface" ]]; then
             update_ifb0 "$old_current_interface" "$interface" "$ingress_bandwidth"
        fi
        configure_cake_egress "$interface" "$egress_bandwidth"
        clean_default_routes "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
    else
        log "Error: Failed to reset default route to $interface via $gateway."
    fi
}

# Function to get the current default gateway and interface
get_current_default_details() {
    ip route | grep '^default' | sort -k8,8n | head -1 | awk '{print $3, $5}'
}

# Function to initialize routing properly
initialize_routing() {
    log "Initializing routing configuration..."
    clean_default_routes # Call without args, will use current_interface if set, or fallback

    local primary_ready=false
    if interface_has_ip "$PRIMARY_INTERFACE"; then
        if [[ -n "$PRIMARY_GATEWAY" ]]; then
            if test_ip_via_interface "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" 2 1; then
                log "Primary Gateway $PRIMARY_GATEWAY reachable via $PRIMARY_INTERFACE."
                ensure_monitoring_route "$PRIMARY_MONITOR" "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE"
                if test_ip_via_interface "$PRIMARY_MONITOR" "$PRIMARY_INTERFACE"; then
                    log "Primary WAN has internet. Setting as default."
                    reset_default_route "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$PRIMARY_EGRESS_BANDWIDTH" "$PRIMARY_INGRESS_BANDWIDTH"
                    return 0
                else
                    log "Primary WAN ($PRIMARY_INTERFACE) no internet to $PRIMARY_MONITOR."
                fi
            else
                log "Primary Gateway $PRIMARY_GATEWAY NOT reachable via $PRIMARY_INTERFACE."
            fi
        else
            log "Primary Gateway for $PRIMARY_INTERFACE is unknown."
        fi
    else
        log "Primary Interface $PRIMARY_INTERFACE has no IP. Cannot initialize."
        send_notification "ALERT: Primary Interface $PRIMARY_INTERFACE has no IP during initialization."
    fi
    
    local secondary_ready=false
    if [[ -n "$SECONDARY_INTERFACE" ]]; then
        if interface_has_ip "$SECONDARY_INTERFACE"; then
            if [[ -n "$SECONDARY_GATEWAY" ]]; then
                if test_ip_via_interface "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" 2 1; then
                    log "Secondary Gateway $SECONDARY_GATEWAY reachable via $SECONDARY_INTERFACE."
                    ensure_monitoring_route "$SECONDARY_MONITOR" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
                    if test_ip_via_interface "$SECONDARY_MONITOR" "$SECONDARY_INTERFACE"; then
                        log "Secondary WAN has internet. Setting as default."
                        reset_default_route "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" "$SECONDARY_EGRESS_BANDWIDTH" "$SECONDARY_INGRESS_BANDWIDTH"
                        return 0
                    else
                        log "Secondary WAN ($SECONDARY_INTERFACE) no internet to $SECONDARY_MONITOR."
                    fi
                else
                    log "Secondary Gateway $SECONDARY_GATEWAY NOT reachable via $SECONDARY_INTERFACE."
                fi
            else
                log "Secondary Gateway for $SECONDARY_INTERFACE is unknown."
            fi
        else
            log "Secondary Interface $SECONDARY_INTERFACE has no IP. Cannot initialize."
            send_notification "ALERT: Secondary Interface $SECONDARY_INTERFACE has no IP during initialization."
        fi
    fi
    
    log "Neither WAN confirmed with internet during initialization."
    # Fallback logic
    if interface_has_ip "$PRIMARY_INTERFACE" && [[ -n "$PRIMARY_GATEWAY" ]] && test_ip_via_interface "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" 1 1; then
        log "Setting fallback default to Primary Gateway (internet not confirmed)."
        ip route replace default via "$PRIMARY_GATEWAY" dev "$PRIMARY_INTERFACE"
        current_interface="$PRIMARY_INTERFACE"
    elif [[ -n "$SECONDARY_INTERFACE" ]] && interface_has_ip "$SECONDARY_INTERFACE" && [[ -n "$SECONDARY_GATEWAY" ]] && test_ip_via_interface "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" 1 1; then
        log "Setting fallback default to Secondary Gateway (internet not confirmed)."
        ip route replace default via "$SECONDARY_GATEWAY" dev "$SECONDARY_INTERFACE"
        current_interface="$SECONDARY_INTERFACE"
    else
        log "No gateways reachable. Cannot set default route during initialization."
        send_notification "CRITICAL ERROR: No gateways reachable during initialization. No default route set."
    fi
    return 1
}

# Function to ensure critical WAN monitor routes are always in place
ensure_critical_wan_monitor_routes() {
    log "Ensuring critical WAN monitor routes..."
    local routes_actioned=false

    if [[ -n "$PRIMARY_INTERFACE" && -n "$PRIMARY_MONITOR" ]]; then
        if ! interface_has_ip "$PRIMARY_INTERFACE"; then
            log "Skipping $PRIMARY_MONITOR route for $PRIMARY_INTERFACE: No IP."
        elif [[ -z "$PRIMARY_GATEWAY" ]]; then
            log "Skipping $PRIMARY_MONITOR route for $PRIMARY_INTERFACE: Gateway not known."
        else
            if ensure_monitoring_route "$PRIMARY_MONITOR" "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE"; then routes_actioned=true; fi
        fi
    fi

    if [[ -n "$SECONDARY_INTERFACE" && -n "$SECONDARY_MONITOR" ]]; then
        if ! interface_has_ip "$SECONDARY_INTERFACE"; then
            log "Skipping $SECONDARY_MONITOR route for $SECONDARY_INTERFACE: No IP."
        elif [[ -z "$SECONDARY_GATEWAY" ]]; then
            log "Skipping $SECONDARY_MONITOR route for $SECONDARY_INTERFACE: Gateway not known."
        else
             if ensure_monitoring_route "$SECONDARY_MONITOR" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"; then routes_actioned=true; fi
        fi
    fi

    if [[ "$routes_actioned" == true ]]; then
        log "Critical WAN monitor routes checked. Relevant routes:"
        (ip route show to "$PRIMARY_MONITOR" 2>/dev/null; ip route show to "$SECONDARY_MONITOR" 2>/dev/null; ip route show to "$ADDITIONAL_MONITOR" 2>/dev/null)  | tee -a "$LOG_FILE"
    fi
}

# --- Script Start ---
touch "$LOG_FILE"
touch "$NOTIFICATION_LOG_FILE" # Ensure notification log file exists
log "===== Intelligent WAN Monitoring Script Started ====="
send_notification "INFO: WAN Monitoring Script Started." # Initial notification

load_config # Exits on failure
validate_config # Exits on failure

PRIMARY_LEASE_FILE="/var/lib/dhcp/dhclient.${PRIMARY_INTERFACE}.leases"
if [[ -n "$SECONDARY_INTERFACE" ]]; then
    SECONDARY_LEASE_FILE="/var/lib/dhcp/dhclient.${SECONDARY_INTERFACE}.leases"
fi

PRIMARY_GATEWAY=$(get_gateway "$PRIMARY_LEASE_FILE" "$PRIMARY_INTERFACE")
if [[ -n "$SECONDARY_INTERFACE" ]]; then
    SECONDARY_GATEWAY=$(get_gateway "$SECONDARY_LEASE_FILE" "$SECONDARY_INTERFACE")
fi

initialize_routing
log "Initial routing established. Current active interface: $current_interface"

# --- Main Loop ---
while true; do
    LOOP_START_TIME=$(date +%s)

    PRIMARY_GATEWAY_NEW=$(get_gateway "$PRIMARY_LEASE_FILE" "$PRIMARY_INTERFACE")
    if [[ -n "$PRIMARY_GATEWAY_NEW" ]]; then PRIMARY_GATEWAY="$PRIMARY_GATEWAY_NEW"; 
    elif ! interface_has_ip "$PRIMARY_INTERFACE"; then PRIMARY_GATEWAY=""; # Invalidate if no IP
    fi

    if [[ -n "$SECONDARY_INTERFACE" ]]; then
        SECONDARY_GATEWAY_NEW=$(get_gateway "$SECONDARY_LEASE_FILE" "$SECONDARY_INTERFACE")
        if [[ -n "$SECONDARY_GATEWAY_NEW" ]]; then SECONDARY_GATEWAY="$SECONDARY_GATEWAY_NEW"; 
        elif ! interface_has_ip "$SECONDARY_INTERFACE"; then SECONDARY_GATEWAY=""; # Invalidate if no IP
        fi
    fi

    # Check for IP and Gateway presence for Primary
    if ! interface_has_ip "$PRIMARY_INTERFACE"; then
        log "CRITICAL: Primary Interface $PRIMARY_INTERFACE has no IP. Cannot proceed with primary checks."
        send_notification "CRITICAL: Primary Interface $PRIMARY_INTERFACE has NO IP ADDRESS."
        PRIMARY_TEST_RESULT=1 # Mark as failed
    elif [[ -z "$PRIMARY_GATEWAY" ]]; then
        log "CRITICAL: Primary Gateway for $PRIMARY_INTERFACE is unknown. Cannot proceed with primary checks."
        send_notification "CRITICAL: Primary Gateway for $PRIMARY_INTERFACE is UNKNOWN."
        PRIMARY_TEST_RESULT=1 # Mark as failed
    else
        PRIMARY_TEST_RESULT=0 # Tentatively OK, will be tested below
    fi

    # Check for IP and Gateway presence for Secondary (if configured)
    if [[ -n "$SECONDARY_INTERFACE" ]]; then
        if ! interface_has_ip "$SECONDARY_INTERFACE"; then
            log "WARNING: Secondary Interface $SECONDARY_INTERFACE has no IP."
            send_notification "WARNING: Secondary Interface $SECONDARY_INTERFACE has NO IP ADDRESS."
            # This doesn't immediately make SECONDARY_TEST_RESULT=1, as it's tested later if needed
        elif [[ -z "$SECONDARY_GATEWAY" ]]; then
            log "WARNING: Secondary Gateway for $SECONDARY_INTERFACE is unknown."
            send_notification "WARNING: Secondary Gateway for $SECONDARY_INTERFACE is UNKNOWN."
        fi
    fi
    log "Loop Start - Primary GW: $PRIMARY_GATEWAY, Secondary GW: $SECONDARY_GATEWAY"

    ensure_critical_wan_monitor_routes

    if ! default_route_exists; then
        log "Default route is missing! Re-initializing routing..."
        initialize_routing
        if ! default_route_exists; then
            log "Still no default route after re-initialization. Sleeping."
            sleep "$CHECK_INTERVAL"; continue
        fi
    fi

    read -r CURRENT_DEFAULT_GATEWAY CURRENT_DEFAULT_INTERFACE <<< "$(get_current_default_details)"
    log "Current Default Route: via $CURRENT_DEFAULT_GATEWAY dev $CURRENT_DEFAULT_INTERFACE"

    if [[ -z "$current_interface" || "$current_interface" != "$CURRENT_DEFAULT_INTERFACE" ]]; then
        log "Global 'current_interface' ($current_interface) updated to actual default ($CURRENT_DEFAULT_INTERFACE)."
        current_interface="$CURRENT_DEFAULT_INTERFACE"
    fi
    
    if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]] && [[ -n "$PRIMARY_GATEWAY" ]] && [[ "$CURRENT_DEFAULT_GATEWAY" != "$PRIMARY_GATEWAY" ]]; then
        log "Mismatch: Active Primary GW ($CURRENT_DEFAULT_GATEWAY) != Expected ($PRIMARY_GATEWAY). Resetting..."
        reset_default_route "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$PRIMARY_EGRESS_BANDWIDTH" "$PRIMARY_INGRESS_BANDWIDTH"
    elif [[ "$current_interface" == "$SECONDARY_INTERFACE" ]] && [[ -n "$SECONDARY_GATEWAY" ]] && [[ "$CURRENT_DEFAULT_GATEWAY" != "$SECONDARY_GATEWAY" ]]; then
        log "Mismatch: Active Secondary GW ($CURRENT_DEFAULT_GATEWAY) != Expected ($SECONDARY_GATEWAY). Resetting..."
        reset_default_route "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE" "$SECONDARY_EGRESS_BANDWIDTH" "$SECONDARY_INGRESS_BANDWIDTH"
    fi

    clean_default_routes "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
    
    if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]] && [[ -n "$PRIMARY_GATEWAY" ]]; then
        ensure_monitoring_route "$ADDITIONAL_MONITOR" "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE"
    elif [[ "$current_interface" == "$SECONDARY_INTERFACE" ]] && [[ -n "$SECONDARY_GATEWAY" ]]; then
        ensure_monitoring_route "$ADDITIONAL_MONITOR" "$SECONDARY_GATEWAY" "$SECONDARY_INTERFACE"
    fi

    # --- Perform ping checks ---
    # Only perform primary ping test if IP and Gateway were present
    if [[ $PRIMARY_TEST_RESULT -eq 0 ]]; then
        log "Testing Primary WAN ($PRIMARY_INTERFACE) using its specific route to $PRIMARY_MONITOR..."
        if ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$PRIMARY_MONITOR" > /dev/null 2>&1; then
            # PRIMARY_TEST_RESULT remains 0
            log "Primary WAN ($PRIMARY_INTERFACE) is UP (can reach $PRIMARY_MONITOR)."
        else
            PRIMARY_TEST_RESULT=1 # Mark as failed
            log "Primary WAN ($PRIMARY_INTERFACE) is DOWN (cannot reach $PRIMARY_MONITOR)."
        fi
    else
        log "Skipping Primary WAN ping test due to no IP or unknown Gateway."
        # PRIMARY_TEST_RESULT is already 1 from checks above
    fi
    
    # --- Failover/Failback Logic ---
    if [[ $PRIMARY_TEST_RESULT -ne 0 ]]; then
        if [[ "$current_interface" != "$PRIMARY_INTERFACE" ]]; then # If primary was already down and we are on secondary.
             log "Primary WAN ($PRIMARY_INTERFACE) is confirmed DOWN (was already not active or test failed)."
        else # Primary was active and just failed
            log "Primary WAN ($PRIMARY_INTERFACE) has FAILED."
            send_notification "CRITICAL: Primary WAN ($PRIMARY_INTERFACE) is DOWN."
        fi
        primary_stability_counter=0
        
        if [[ "$current_interface" != "$SECONDARY_INTERFACE" ]]; then # If not already on secondary
            if [[ -n "$SECONDARY_INTERFACE" ]]; then # If secondary is configured
                log "Checking health of Secondary WAN ($SECONDARY_INTERFACE) before attempting failover..."
                SECONDARY_FAILOVER_HEALTH_CHECK_RESULT=1 # Default to unhealthy

                if ! interface_has_ip "$SECONDARY_INTERFACE"; then
                    log "Secondary WAN ($SECONDARY_INTERFACE) has no IP. Cannot failover."
                    send_notification "ALERT: Secondary WAN ($SECONDARY_INTERFACE) has no IP. Failover aborted."
                elif [[ -z "$SECONDARY_GATEWAY" ]]; then
                    log "Secondary WAN ($SECONDARY_INTERFACE) gateway is unknown. Cannot failover."
                    send_notification "ALERT: Secondary WAN ($SECONDARY_INTERFACE) gateway unknown. Failover aborted."
                else
                    log "Testing Secondary WAN for failover: Pinging $SECONDARY_MONITOR via $SECONDARY_INTERFACE"
                    if ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$SECONDARY_MONITOR" > /dev/null 2>&1 ;  then
                        log "Secondary WAN ($SECONDARY_INTERFACE) is healthy for failover."
                        SECONDARY_FAILOVER_HEALTH_CHECK_RESULT=0
                    else
                        log "Secondary WAN ($SECONDARY_INTERFACE) is NOT healthy for failover. Failover aborted."
                        send_notification "ALERT: Secondary WAN ($SECONDARY_INTERFACE) is NOT healthy. Failover aborted."
                    fi
                fi

                if [[ $SECONDARY_FAILOVER_HEALTH_CHECK_RESULT -eq 0 ]]; then
                    switch_to_interface "$SECONDARY_INTERFACE" "$SECONDARY_GATEWAY" "$SECONDARY_EGRESS_BANDWIDTH" "$SECONDARY_INGRESS_BANDWIDTH"
                    if [[ "$current_interface" == "$SECONDARY_INTERFACE" ]]; then
                        send_notification "INFO: Successfully failed over to Secondary WAN ($SECONDARY_INTERFACE)."
                    else
                        send_notification "ERROR: Attempted failover to Secondary WAN ($SECONDARY_INTERFACE) but switch was not confirmed by current_interface."
                    fi
                else
                    log "Failover to Secondary WAN ($SECONDARY_INTERFACE) aborted due to its health. Both WANs may be problematic."
                    send_notification "CRITICAL: Failover to Secondary WAN ($SECONDARY_INTERFACE) aborted. Both WANs may be down or secondary unusable."
                fi
            else
                log "Primary WAN is down, and no Secondary WAN is configured. No failover possible."
            fi
        else # Already using Secondary WAN, and Primary just reported as down again
            log "Already using Secondary WAN ($SECONDARY_INTERFACE). Primary is confirmed down. Checking Secondary's health..."
            SECONDARY_TEST_RESULT=1 # Default to failure
            if interface_has_ip "$SECONDARY_INTERFACE" && [[ -n "$SECONDARY_GATEWAY" ]]; then
                if ping -c "$PING_COUNT" -W "$PING_TIMEOUT" "$SECONDARY_MONITOR" > /dev/null 2>&1 && \
                   ping -c 2 -W 1 "$ADDITIONAL_MONITOR" > /dev/null 2>&1; then 
                    SECONDARY_TEST_RESULT=0
                fi
            else
                 log "Secondary WAN ($SECONDARY_INTERFACE) cannot be tested: No IP or Gateway unknown."
            fi
            
            if [[ $SECONDARY_TEST_RESULT -ne 0 ]]; then
                log "Secondary WAN ($SECONDARY_INTERFACE) is also down."
                send_notification "CRITICAL: Secondary WAN ($SECONDARY_INTERFACE) is also DOWN. Both WANs are down."
                log "Both WANs appear to be down. Attempting re-initialization of routing..."
                initialize_routing
            else
                log "Secondary WAN ($SECONDARY_INTERFACE) is healthy and currently in use."
            fi
        fi
    else # Primary WAN is healthy ($PRIMARY_TEST_RESULT -eq 0)
        if [[ "$current_interface" != "$PRIMARY_INTERFACE" ]]; then # If not on Primary, consider switching back
             log "Primary WAN ($PRIMARY_INTERFACE) is healthy (was not active)."
        fi
        primary_stability_counter=$((primary_stability_counter + 1))
        log "Primary stability counter: $primary_stability_counter/$PRIMARY_STABILITY_THRESHOLD"
        
        if [[ "$current_interface" != "$PRIMARY_INTERFACE" ]]; then 
            if [[ $primary_stability_counter -ge $PRIMARY_STABILITY_THRESHOLD ]]; then
                log "Primary WAN ($PRIMARY_INTERFACE) stable for $primary_stability_counter checks. Preparing for comprehensive test for failback..."
                
                if ! interface_has_ip "$PRIMARY_INTERFACE" || [[ -z "$PRIMARY_GATEWAY" ]]; then
                     log "Failback check: $PRIMARY_INTERFACE has no IP or Gateway unknown. Resetting stability."
                     send_notification "ALERT: Failback check for $PRIMARY_INTERFACE failed: No IP or Gateway unknown."
                     primary_stability_counter=0
                elif ! test_ip_via_interface "$PRIMARY_GATEWAY" "$PRIMARY_INTERFACE" 2 1; then
                     log "Failback check: Primary Gateway $PRIMARY_GATEWAY NOT reachable via $PRIMARY_INTERFACE. Resetting stability."
                     send_notification "ALERT: Failback check for $PRIMARY_INTERFACE failed: Gateway $PRIMARY_GATEWAY not reachable."
                     primary_stability_counter=0
                else
                    log "Primary Gateway $PRIMARY_GATEWAY reachable. Performing comprehensive test for failback..."
                    if comprehensive_connectivity_test "$PRIMARY_INTERFACE" "$PRIMARY_MONITOR" "$ADDITIONAL_MONITOR"; then
                        log "Primary WAN ($PRIMARY_INTERFACE) passed comprehensive tests. Switching back."
                        switch_to_interface "$PRIMARY_INTERFACE" "$PRIMARY_GATEWAY" "$PRIMARY_EGRESS_BANDWIDTH" "$PRIMARY_INGRESS_BANDWIDTH"
                        if [[ "$current_interface" == "$PRIMARY_INTERFACE" ]]; then
                             send_notification "INFO: Successfully failed back to Primary WAN ($PRIMARY_INTERFACE)."
                        else
                            send_notification "ERROR: Attempted failback to Primary WAN ($PRIMARY_INTERFACE) but switch was not confirmed."
                        fi
                    else
                        log "Primary WAN ($PRIMARY_INTERFACE) FAILED comprehensive testing for failback. Staying on $current_interface."
                        send_notification "ALERT: Primary WAN ($PRIMARY_INTERFACE) FAILED comprehensive test for failback."
                        primary_stability_counter=0
                    fi
                fi
            else
                log "Primary WAN ($PRIMARY_INTERFACE) detected but waiting for stability ($primary_stability_counter/$PRIMARY_STABILITY_THRESHOLD) for failback. Staying on $current_interface."
            fi
        else # Already using Primary WAN
            # log "Already using Primary WAN ($PRIMARY_INTERFACE) and it is healthy." # Can be verbose
            primary_stability_counter=$PRIMARY_STABILITY_THRESHOLD 
        fi
    fi

    # Final check of ADDITIONAL_MONITOR via current default route
    if [[ -n "$current_interface" ]] && interface_has_ip "$current_interface" ; then
        if ping -c 2 -W 1 "$ADDITIONAL_MONITOR" > /dev/null 2>&1; then
            # log "Additional Monitor ($ADDITIONAL_MONITOR) is reachable via current default route ($current_interface)." # Verbose
            : # Do nothing, it's fine
        else
            log "WARNING: Additional Monitor ($ADDITIONAL_MONITOR) is NOT reachable via current default route ($current_interface)."
            send_notification "WARNING: Additional Monitor ($ADDITIONAL_MONITOR) is NOT reachable via active WAN ($current_interface)."
        fi
    fi

    # --- Loop Timing ---
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - LOOP_START_TIME))
    # log "This check iteration took $ELAPSED seconds." # Can be verbose
    
    if [[ $ELAPSED -lt $CHECK_INTERVAL ]]; then
        SLEEP_TIME=$((CHECK_INTERVAL - ELAPSED))
        # log "Sleeping for $SLEEP_TIME seconds..." # Verbose
        sleep $SLEEP_TIME
    else
        log "Check took longer than interval ($ELAPSED s vs $CHECK_INTERVAL s). Not sleeping."
    fi
done

