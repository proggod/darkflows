#!/bin/bash

# Check if script name is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <script_path>"
    exit 1
fi

SCRIPT_PATH="$1"
SCRIPT_NAME=$(basename "$SCRIPT_PATH")  # Extract filename from full path
LOG_FILE="/var/log/${SCRIPT_NAME}.log"
PID_FILE="/var/run/${SCRIPT_NAME}.pid"

# Determine how to execute the script
if [[ "$SCRIPT_PATH" == *.py ]]; then
    INTERPRETER="/usr/bin/python3"
elif [[ "$SCRIPT_PATH" == *.sh ]]; then
    INTERPRETER="/bin/bash"
else
    echo "Unsupported file type. Only .py and .sh scripts are supported."
    exit 1
fi

# Ensure previous log file is cleared
> "$LOG_FILE"

# Run the script in the background with nohup
nohup "$INTERPRETER" "$SCRIPT_PATH" > "$LOG_FILE" 2>&1 &

# Get the process ID
PID=$!

# Save the PID to a file
echo "$PID" > "$PID_FILE"

echo "Started $SCRIPT_PATH with PID $PID"
echo "Logs: $LOG_FILE"
echo "PID File: $PID_FILE"

