import subprocess
import json
import time

# Configuration file path
CONFIG_FILE = "/etc/darkflows/d_network.cfg"
LOG_FILE = "/var/log/speedtest.log"

# Temporary high bandwidth for speed tests
HIGH_BANDWIDTH = "5000mbit"  # 5 Gbps

def log(message):
    """Log messages to a file and print to console."""
    with open(LOG_FILE, "a") as f:
        f.write(f"{time.ctime()} - {message}\n")
    print(message)

def run_command(command):
    """Run a shell command and return its output."""
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        log(f"Error running command: {command}\n{result.stderr}")
        return None
    return result.stdout

def load_config():
    """Load configuration from the config file."""
    config = {}
    try:
        with open(CONFIG_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    config[key] = value.strip('"')
        log("Configuration loaded successfully.")
        return config
    except Exception as e:
        log(f"Error loading configuration: {e}")
        exit(1)

def get_gateway(interface):
    """Get the gateway for a given interface from its DHCP lease file."""
    lease_file = f"/var/lib/dhcp/dhclient.{interface}.leases"
    try:
        with open(lease_file, "r") as f:
            for line in f:
                if "option routers" in line:
                    gateway = line.split()[-1].strip(";")
                    return gateway
        log(f"No gateway found for {interface}.")
        return None
    except Exception as e:
        log(f"Error reading lease file for {interface}: {e}")
        return None

def set_default_route(interface, gateway):
    """Set the default route for a given interface and gateway."""
    log(f"Setting default route to {gateway} on {interface}...")
    run_command(f"ip route replace default via {gateway} dev {interface}")

def configure_cake(interface, bandwidth, is_ingress=False, cake_params=""):
    """Configure CAKE on a given interface with the full configuration."""
    log(f"Configuring CAKE on {interface} with bandwidth {bandwidth}...")
    if is_ingress:
        # Ingress traffic on ifb0
        run_command(
            f"tc qdisc replace dev ifb0 root handle 1: cake bandwidth {bandwidth} "
            f"memlimit 32mb {cake_params}"
        )
    else:
        # Egress traffic on the interface
        run_command(
            f"tc qdisc replace dev {interface} root cake bandwidth {bandwidth} "
            f"nat memlimit 32mb {cake_params}"
        )

def run_speedtest():
    """Run a speed test and return the parsed results."""
    log("Running speed test...")
    try:
        speedtest = subprocess.Popen(
            ["speedtest", "--accept-license", "--format=json"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        stdout, stderr = speedtest.communicate()

        if speedtest.returncode != 0:
            log(f"Speed test failed: {stderr}")
            return None

        result = json.loads(stdout)
        parsed_result = {
            "download": result["download"]["bandwidth"] * 8 / 1000000,  # Convert to Mbps
            "upload": result["upload"]["bandwidth"] * 8 / 1000000,
            "ping": result["ping"]["latency"],
            "jitter": result["ping"]["jitter"],
            "packetLoss": result.get("packetLoss", 0),
            "server": f"{result['server']['name']} - {result['server']['location']}",
            "isp": result["isp"],
            "url": result["result"]["url"]
        }
        log(f"Speed test results: {parsed_result}")
        return parsed_result
    except Exception as e:
        log(f"Error running speed test: {e}")
        return None

def update_config(config, primary_results, secondary_results):
    """Update the configuration file with 85% of the speed test results."""
    log("Updating configuration file with new bandwidth limits...")

    try:
        with open(CONFIG_FILE, "r") as f:
            lines = f.readlines()

        with open(CONFIG_FILE, "w") as f:
            for line in lines:
                if line.startswith("PRIMARY_EGRESS_BANDWIDTH=") and primary_results:
                    new_download = int(primary_results["download"] * 0.85)
                    line = f'PRIMARY_EGRESS_BANDWIDTH="{new_download}mbit"\n'
                    log(f"Updated PRIMARY_EGRESS_BANDWIDTH to {new_download}mbit")
                elif line.startswith("PRIMARY_INGRESS_BANDWIDTH=") and primary_results:
                    new_upload = int(primary_results["upload"] * 0.85)
                    line = f'PRIMARY_INGRESS_BANDWIDTH="{new_upload}mbit"\n'
                    log(f"Updated PRIMARY_INGRESS_BANDWIDTH to {new_upload}mbit")
                elif line.startswith("SECONDARY_EGRESS_BANDWIDTH=") and secondary_results:
                    new_download = int(secondary_results["download"] * 0.85)
                    line = f'SECONDARY_EGRESS_BANDWIDTH="{new_download}mbit"\n'
                    log(f"Updated SECONDARY_EGRESS_BANDWIDTH to {new_download}mbit")
                elif line.startswith("SECONDARY_INGRESS_BANDWIDTH=") and secondary_results:
                    new_upload = int(secondary_results["upload"] * 0.85)
                    line = f'SECONDARY_INGRESS_BANDWIDTH="{new_upload}mbit"\n'
                    log(f"Updated SECONDARY_INGRESS_BANDWIDTH to {new_upload}mbit")
                f.write(line)
        log("Configuration updated successfully.")
    except Exception as e:
        log(f"Error updating configuration file: {e}")

def show_tc_qdisc(interfaces):
    """Display the current CAKE configuration for all interfaces."""
    log("===== Current CAKE Configuration =====")
    for interface in interfaces:
        log(f"Interface: {interface}")
        output = run_command(f"tc qdisc show dev {interface}")
        if output:
            log(output.strip())
        else:
            log("No CAKE configuration found.")
    log("======================================")

def main():
    log("Starting speed test and configuration update process...")

    # Load configuration
    config = load_config()
    primary_interface = config.get("PRIMARY_INTERFACE")
    secondary_interface = config.get("SECONDARY_INTERFACE")
    internal_interface = config.get("INTERNAL_INTERFACE")
    cake_params = config.get("CAKE_PARAMS", "")

    if not primary_interface or not secondary_interface or not internal_interface:
        log("Error: Missing interface configuration.")
        exit(1)

    # Get gateways
    primary_gateway = get_gateway(primary_interface)
    secondary_gateway = get_gateway(secondary_interface)

    if not primary_gateway or not secondary_gateway:
        log("Error: Could not retrieve gateways for interfaces.")
        exit(1)

    # Step 1: Switch to primary connection and set CAKE to high bandwidth
    set_default_route(primary_interface, primary_gateway)
    configure_cake(primary_interface, HIGH_BANDWIDTH, cake_params=cake_params)
    configure_cake("ifb0", HIGH_BANDWIDTH, is_ingress=True, cake_params=cake_params)

    # Step 2: Verify CAKE configuration
    show_tc_qdisc([primary_interface, secondary_interface, internal_interface, "ifb0"])

    # Step 3: Run speed test on primary connection
    primary_results = run_speedtest()
    if not primary_results:
        log("Skipping secondary connection due to primary speed test failure.")
        exit(1)

    # Step 4: Switch to secondary connection and set CAKE to high bandwidth
    set_default_route(secondary_interface, secondary_gateway)
    configure_cake(secondary_interface, HIGH_BANDWIDTH, cake_params=cake_params)
    configure_cake("ifb0", HIGH_BANDWIDTH, is_ingress=True, cake_params=cake_params)

    # Step 5: Verify CAKE configuration
    show_tc_qdisc([primary_interface, secondary_interface, internal_interface, "ifb0"])

    # Step 6: Run speed test on secondary connection
    secondary_results = run_speedtest()
    if not secondary_results:
        log("Secondary speed test failed. Continuing with primary results.")

    # Step 7: Switch back to primary connection and reconfigure CAKE
    set_default_route(primary_interface, primary_gateway)
    configure_cake(primary_interface, f"{int(primary_results['download'] * 0.85)}mbit", cake_params=cake_params)
    configure_cake("ifb0", f"{int(primary_results['download'] * 0.85)}mbit", is_ingress=True, cake_params=cake_params)
    configure_cake(internal_interface, config.get("INTERNAL_EGRESS_BANDWIDTH"), cake_params=cake_params)

    # Step 8: Update configuration with 85% of speed test results
    update_config(config, primary_results, secondary_results)

    # Step 9: Display current CAKE configuration for all interfaces
    show_tc_qdisc([primary_interface, secondary_interface, internal_interface, "ifb0"])

    log("Process completed successfully.")

if __name__ == "__main__":
    main()



