#!/bin/bash

IFACE="ifb0"

# Function to map class IDs to IP addresses and directions
get_class_ip_map() {
    declare -gA CLASS_IP_MAP
    CLASS_IP_MAP=()
    while IFS= read -r line; do
        if [[ $line =~ flowid[[:space:]]([0-9:]+) ]]; then
            flowid="${BASH_REMATCH[1]}"
        elif [[ $line =~ match[[:space:]]+([0-9a-fA-F]+)/([0-9a-fA-F]+)[[:space:]]+at[[:space:]](12|16) ]]; then
            hex_ip="${BASH_REMATCH[1],,}"  # Convert to lowercase
            offset="${BASH_REMATCH[3]}"
            
            # Convert hex to IP
            ip=$(printf "%d.%d.%d.%d" \
                0x${hex_ip:0:2} 0x${hex_ip:2:2} \
                0x${hex_ip:4:2} 0x${hex_ip:6:2})
                
            # Determine direction
            direction="src"
            [[ $offset == "16" ]] && direction="dst"
            
            CLASS_IP_MAP["$flowid"]="$ip ($direction)"
        fi
    done < <(tc filter show dev "$IFACE")
}

# Initialize mapping
get_class_ip_map

# Main monitoring loop
while true; do
    # Get initial bytes
    declare -A bytes1
    while IFS= read -r classid bytes; do
        bytes1["$classid"]=$bytes
    done < <(tc -s class show dev "$IFACE" | awk '
        /class .* [0-9]+:([0-9]+)/ {classid=$3}
        /Sent [0-9]+ bytes/ {print classid, $2}')

    sleep 1

    # Get second bytes reading
    declare -A bytes2
    while IFS= read -r classid bytes; do
        bytes2["$classid"]=$bytes
    done < <(tc -s class show dev "$IFACE" | awk '
        /class .* [0-9]+:([0-9]+)/ {classid=$3}
        /Sent [0-9]+ bytes/ {print classid, $2}')

    # Clear screen and print header
    clear
    printf "%-16s %-8s %-15s %s\n" "IP Address" "Dir" "Class ID" "Bandwidth (Mbps)"
    echo "---------------------------------------------------"

    # Calculate and display bandwidth
    for classid in "${!bytes2[@]}"; do
        b1=${bytes1["$classid"]}
        b2=${bytes2["$classid"]}
        
        if [[ -n $b1 && -n $b2 ]]; then
            diff_bytes=$((b2 - b1))
            mbps=$((diff_bytes * 8 / 1000000))  # Convert bytes to megabits
            
            ip_info="${CLASS_IP_MAP[$classid]:-Unknown}"
            ip=${ip_info% (*}
            dir=${ip_info#* (}
            dir=${dir%)*}
            
            printf "%-16s %-8s %-15s %'d\n" "$ip" "${dir^^}" "$classid" "$mbps"
        fi
    done | sort -nrk4

    # Refresh IP mapping every 30 seconds
    if (( $(date +%s) % 30 == 0 )); then
        get_class_ip_map
    fi
done

