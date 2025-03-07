# WiFi Setup for Darkflows

This utility helps you set up a WiFi access point on your Darkflows Debian router.

## Features

- Automatically detects WiFi devices with AP mode support
- Supports both 2.4GHz and 5GHz bands
- Configures hostapd with optimal settings based on your hardware
- Sets up bridge networking to connect WiFi and wired networks
- Updates firewall rules and enables IP forwarding
- Creates a boot script for persistent configuration
- Updates Kea DHCP to include the WiFi network

## Installation

1. Download all script files to your Darkflows router
2. Make the installation script executable: `chmod +x install.sh`
3. Run the installation script as root: `sudo ./install.sh`

## Usage

Run the script with the following format:

```bash
sudo wifi-setup --ssid YOUR_WIFI_NAME --password YOUR_SECURE_PASSWORD
```

### Optional Parameters

- `--wifi-device DEVICE`: Specify the WiFi device (e.g., wlan0, wlx00224366de99)
- `--channel CHANNEL`: Set a specific channel (e.g., 6 for 2.4GHz, 36 for 5GHz)
- `--band 2.4|5|auto`: Select WiFi band (default: auto - uses 5GHz if available)
- `--bridge BRIDGE`: Specify bridge interface name (default: first available br0, br1, etc.)

### Examples

Basic usage (auto-detects everything):
```bash
sudo wifi-setup --ssid MyWiFiNetwork --password SecurePass123
```

Specific WiFi device and band:
```bash
sudo wifi-setup --wifi-device wlan0 --ssid MyWiFiNetwork --password SecurePass123 --band 5
```

Custom channel and bridge name:
```bash
sudo wifi-setup --ssid MyWiFiNetwork --password SecurePass123 --channel 36 --bridge br1
```

## Troubleshooting

If the WiFi doesn't work after setup, check the following:

- `systemctl status hostapd` for hostapd errors
- `systemctl status wifi-routing` for routing issues
- `ip link show` to verify bridge interface is up
- `brctl show` to verify bridge connections

You can also check the hostapd configuration at `/etc/hostapd/hostapd.conf`.

## Additional Information

The script modifies the following files:
- `/etc/network/interfaces`: Updated with bridge configuration
- `/etc/darkflows/d_network.cfg`: Internal interface set to the bridge
- `/etc/hostapd/hostapd.conf`: WiFi configuration
- `/etc/kea/kea-dhcp4.conf`: Updated to include the bridge interface

The script also creates:
- `/usr/local/darkflows/bin/wifi-routing.sh`: Boot script for routing setup
- `/etc/systemd/system/wifi-routing.service`: Systemd service for the boot script

## Files

- `wifi_setup.py`: Main script
- `wifi_setup_wifi.py`: WiFi detection module
- `wifi_setup_config.py`: Configuration module
- `install.sh`: Installation script

