import subprocess
import re
import time
import json
import os
from datetime import datetime
from collections import deque

# Configuration
SERVERS = {
    "PRIMARY": "8.8.4.4",  # Server 1: PRIMARY
    "SECONDARY": "1.0.0.1",    # Server 2: SECONDARY
}
ALPHA = 0.3                          # Smoothing factor for rolling average
INTERVAL = 5                         # Time between pings (in seconds)
OUTPUT_FILE = "/dev/shm/ping_status.json"  # Path to the shared memory file
TEMP_FILE = "/dev/shm/ping_status.json.tmp"  # Temporary file for atomic write (also in /dev/shm)
CONSECUTIVE_SUCCESS_THRESHOLD = 20   # Number of consecutive successful pings to clear packet_loss flag
SAMPLE_SIZE = 25                     # Number of samples to store

# Initialize variables for each server
metrics = {
    label: {
        "rolling_avg": None,  # Initialize rolling average as None
        "ping_count": 0,
        "consecutive_successes": 0,
        "packet_loss": False,
        "highest_ping": None,  # Track highest ping
        "lowest_ping": None,   # Track lowest ping
        "samples": deque(maxlen=SAMPLE_SIZE),  # Store last 25 samples
    }
    for label in SERVERS
}

def calculate_rolling_avg(label, new_delay):
    """Calculate the rolling average using exponential smoothing for a specific server."""
    if metrics[label]["rolling_avg"] is None:
        # Initialize rolling average with the first successful ping
        metrics[label]["rolling_avg"] = new_delay
    else:
        # Update rolling average using exponential smoothing
        metrics[label]["rolling_avg"] = (
            ALPHA * new_delay + (1 - ALPHA) * metrics[label]["rolling_avg"]
        )
    return metrics[label]["rolling_avg"]

def update_high_low(label, delay):
    """Update the highest and lowest ping for a specific server."""
    if metrics[label]["highest_ping"] is None or delay > metrics[label]["highest_ping"]:
        metrics[label]["highest_ping"] = delay
    if metrics[label]["lowest_ping"] is None or delay < metrics[label]["lowest_ping"]:
        metrics[label]["lowest_ping"] = delay

def ping_target(server):
    """Ping the server and return the delay in milliseconds (or None if packet loss)."""
    try:
        # Run the ping command
        output = subprocess.run(
            ["ping", "-c", "1", server],
            capture_output=True,
            text=True,
            timeout=INTERVAL,
        ).stdout

        # Check for packet loss
        if "1 received" in output:
            # Extract the delay using a regular expression
            match = re.search(r"time=([0-9.]+) ms", output)
            if match:
                return float(match.group(1))
        # Packet loss occurred
        return None
    except subprocess.TimeoutExpired:
        # Ping timed out (considered packet loss)
        return None

def generate_json():
    """Generate JSON data with timestamp, delay, rolling average, packet_loss flag, highest ping, lowest ping, and last 25 samples for each server."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    json_data = {"timestamp": timestamp, "servers": {}}

    for label, server in SERVERS.items():
        # Handle None values for last_delay
        last_delay = metrics[label].get("last_delay")
        ping_delay_ms = round(last_delay) if last_delay is not None else None

        # Handle None values for rolling_avg
        rolling_avg = metrics[label]["rolling_avg"]
        rolling_avg_ms = round(rolling_avg) if rolling_avg is not None else None

        # Handle None values for highest_ping and lowest_ping
        highest_ping = metrics[label]["highest_ping"]
        highest_ping_rounded = round(highest_ping) if highest_ping is not None else None

        lowest_ping = metrics[label]["lowest_ping"]
        lowest_ping_rounded = round(lowest_ping) if lowest_ping is not None else None

        # Format the samples array as a single line
        samples_str = ", ".join(map(str, [round(sample) for sample in metrics[label]["samples"]]))

        json_data["servers"][label] = {
            "ping_delay_ms": ping_delay_ms,
            "rolling_avg_ms": rolling_avg_ms,
            "packet_loss": metrics[label]["packet_loss"],
            "highest_ping": highest_ping_rounded,
            "lowest_ping": lowest_ping_rounded,
            "samples": f"[{samples_str}]",  # Format samples as a single line
        }

    # Use custom separators to remove linefeeds after each sample
    return json.dumps(json_data, indent=2, separators=(",", ": "))

def write_json_to_file(data):
    """Write JSON data to the file atomically."""
    # Write to a temporary file first (in /dev/shm)
    with open(TEMP_FILE, "w") as file:
        file.write(data)
    # Atomically move the temporary file to the output file
    os.replace(TEMP_FILE, OUTPUT_FILE)
    # Set appropriate permissions
    os.chmod(OUTPUT_FILE, 0o644)

def main():
    while True:
        # Ping all servers
        for label, server in SERVERS.items():
            delay = ping_target(server)

            if delay is not None:
                # Ping succeeded
                metrics[label]["ping_count"] += 1
                metrics[label]["consecutive_successes"] += 1
                metrics[label]["last_delay"] = delay

                # Calculate the rolling average
                avg = calculate_rolling_avg(label, delay)

                # Update highest and lowest ping
                update_high_low(label, delay)

                # Add the sample to the deque
                metrics[label]["samples"].append(delay)

                # Clear packet_loss flag if we have enough consecutive successes
                if (
                    metrics[label]["packet_loss"]
                    and metrics[label]["consecutive_successes"] >= CONSECUTIVE_SUCCESS_THRESHOLD
                ):
                    metrics[label]["packet_loss"] = False
                    metrics[label]["consecutive_successes"] = 0  # Reset counter
            else:
                # Ping failed (packet loss)
                metrics[label]["consecutive_successes"] = 0
                metrics[label]["packet_loss"] = True
                metrics[label]["last_delay"] = None

        # Generate JSON data
        json_data = generate_json()

        # Write JSON data to the file atomically
        write_json_to_file(json_data)

        # Display the result on the screen
        print(json_data)

        # Wait for the specified interval before the next ping
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()

