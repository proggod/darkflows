#!/usr/bin/env python3
"""
WiFi Setup Script for Darkflows Debian Router - Part 2 (WiFi Detection Module)
This module handles WiFi device detection and capabilities
"""

import os
import subprocess
import sys
import time

def run_command(command, check=True):
    """Run a shell command and return the output"""
    try:
        result = subprocess.run(command, shell=True, check=check, 
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        print(f"Error message: {e.stderr}")
        if check:
            sys.exit(1)
        return "", e.stderr, e.returncode

def detect_wifi_capabilities(wifi_device):
    """Detect WiFi device capabilities including supported bands"""
    capabilities = {
        'supports_5ghz': False,
        'supports_2ghz': False,
        'supports_80211ac': False,
        'supports_80211n': False,
        'max_tx_power': 20,  # Default value in dBm
        'phy_name': None
    }
    
    # Get the phy name for the interface
    stdout, stderr, retcode = run_command(f"iw dev {wifi_device} info | grep wiphy | awk '{{print $2}}'", check=False)
    if retcode == 0 and stdout:
        phy_num = stdout.strip()
        capabilities['phy_name'] = f"phy{phy_num}"
        
        # Check supported bands
        stdout, stderr, retcode = run_command(f"iw phy phy{phy_num} info | grep -A 2 'Band [12]:'", check=False)
        if retcode == 0:
            if "Band 1:" in stdout:  # 2.4 GHz
                capabilities['supports_2ghz'] = True
            if "Band 2:" in stdout:  # 5 GHz
                capabilities['supports_5ghz'] = True
        
        # Check 802.11n support
        stdout, stderr, retcode = run_command(f"iw phy phy{phy_num} info | grep -A 10 'Capabilities' | grep 'HT20/HT40'", check=False)
        if retcode == 0:
            capabilities['supports_80211n'] = True
        
        # Check 802.11ac support
        stdout, stderr, retcode = run_command(f"iw phy phy{phy_num} info | grep -A 10 'VHT Capabilities'", check=False)
        if retcode == 0:
            capabilities['supports_80211ac'] = True
        
        # Get max TX power
        stdout, stderr, retcode = run_command(f"iw phy phy{phy_num} info | grep 'maximal tx power' | head -1 | awk '{{print $5}}'", check=False)
        if retcode == 0 and stdout:
            try:
                # Convert from dBm
                capabilities['max_tx_power'] = int(float(stdout.strip()))
            except ValueError:
                pass
    else:
        # Fallback method if we couldn't get the phy name
        # Check for 5GHz support
        stdout, stderr, retcode = run_command(f"iw list | grep -A 10 'Frequencies:' | grep '5[0-9][0-9][0-9] MHz'", check=False)
        if retcode == 0:
            capabilities['supports_5ghz'] = True
        
        # Check for 2.4GHz support
        stdout, stderr, retcode = run_command(f"iw list | grep -A 10 'Frequencies:' | grep '24[0-9][0-9] MHz'", check=False)
        if retcode == 0:
            capabilities['supports_2ghz'] = True
        
        # Check 802.11n support
        stdout, stderr, retcode = run_command(f"iw list | grep -A 10 'Capabilities' | grep 'HT20/HT40'", check=False)
        if retcode == 0:
            capabilities['supports_80211n'] = True
            
        # Check 802.11ac support
        stdout, stderr, retcode = run_command(f"iw list | grep -A 10 'VHT Capabilities'", check=False)
        if retcode == 0:
            capabilities['supports_80211ac'] = True
    
    return capabilities

def find_available_wifi_devices():
    """Find all available WiFi devices that support AP mode"""
    available_devices = []
    
    # Check if iw is installed, if not install it
    stdout, stderr, retcode = run_command("which iw", check=False)
    if retcode != 0:
        print("Installing iw...")
        run_command("apt update && apt install -y iw")
    
    # Get list of all wireless devices
    stdout, stderr, retcode = run_command("iw dev | grep Interface | awk '{print $2}'", check=False)
    if retcode == 0 and stdout:
        devices = stdout.strip().split('\n')
        
        for device in devices:
            # Check if the device supports AP mode
            # Get the phy name for the interface
            stdout, stderr, retcode = run_command(f"iw dev {device} info | grep wiphy | awk '{{print $2}}'", check=False)
            if retcode != 0 or not stdout:
                continue
                
            phy_num = stdout.strip()
            phy_check_cmd = f"iw phy phy{phy_num} info | grep -A 10 'Supported interface modes' | grep '\\* AP'"
            
            stdout, stderr, retcode = run_command(phy_check_cmd, check=False)
            if retcode == 0:  # Device supports AP mode
                available_devices.append(device)
    
    # If no devices found with iw, try using nmcli
    if not available_devices:
        stdout, stderr, retcode = run_command("which nmcli", check=False)
        if retcode == 0:
            stdout, stderr, retcode = run_command("nmcli -t -f DEVICE,TYPE device | grep ':wifi$' | cut -d: -f1", check=False)
            if retcode == 0 and stdout:
                devices = stdout.strip().split('\n')
                for device in devices:
                    available_devices.append(device)
    
    # If still no devices found, try using lshw
    if not available_devices:
        stdout, stderr, retcode = run_command("which lshw", check=False)
        if retcode != 0:
            run_command("apt update && apt install -y lshw")
        
        stdout, stderr, retcode = run_command("lshw -C network | grep -A 2 'Wireless' | grep 'logical name' | awk '{print $3}'", check=False)
        if retcode == 0 and stdout:
            devices = stdout.strip().split('\n')
            for device in devices:
                available_devices.append(device)
    
    return available_devices

def find_available_bridge_name():
    """Find an available bridge interface name"""
    for i in range(10):  # Try br0 through br9
        bridge_name = f"br{i}"
        stdout, stderr, retcode = run_command(f"ip link show {bridge_name}", check=False)
        if retcode != 0:  # Bridge doesn't exist
            return bridge_name
    
    return "br_wifi"  # Fallback name

def select_random_channel(band):
    """Select a random channel for the given band"""
    if band == "5":
        # 5GHz channels (non-DFS) - these should be universally available
        channels = ["36", "40", "44", "48", "149", "153", "157", "161", "165"]
        return channels[int(time.time()) % len(channels)]
    else:
        # 2.4GHz channels - avoid overlapping channels
        channels = ["1", "6", "11"]
        return channels[int(time.time()) % len(channels)]

def verify_wifi_device(wifi_device):
    """Verify that the WiFi device exists and supports AP mode"""
    # Check if the device exists
    stdout, stderr, retcode = run_command(f"ip link show {wifi_device}", check=False)
    if retcode != 0:
        print(f"Error: WiFi device {wifi_device} not found.")
        print("Available network interfaces:")
        run_command("ip link show | grep -v 'lo:' | awk -F': ' '{print $2}'")
        sys.exit(1)
    
    # Check if iw is installed, if not install it
    stdout, stderr, retcode = run_command("which iw", check=False)
    if retcode != 0:
        print("Installing iw...")
        run_command("apt update && apt install -y iw")
    
    # Check if the device supports AP mode
    print(f"Checking if {wifi_device} supports AP mode...")
    
    # Get the phy name for the interface
    stdout, stderr, retcode = run_command(f"iw dev {wifi_device} info | grep wiphy | awk '{{print $2}}'", check=False)
    if retcode != 0 or not stdout:
        print(f"Warning: Could not get wiphy number for {wifi_device}")
        phy_check_cmd = f"iw list | grep -A 10 'Supported interface modes' | grep '\\* AP'"
    else:
        phy_num = stdout.strip()
        phy_check_cmd = f"iw phy phy{phy_num} info | grep -A 10 'Supported interface modes' | grep '\\* AP'"
    
    stdout, stderr, retcode = run_command(phy_check_cmd, check=False)
    if retcode != 0:
        print(f"ERROR: WiFi device {wifi_device} does NOT support AP mode!")
        print("Please select a different WiFi adapter that supports AP mode.")
        sys.exit(1)
    else:
        print(f"WiFi device {wifi_device} supports AP mode. Continuing setup...")
        
    # Get more detailed WiFi capabilities
    return detect_wifi_capabilities(wifi_device)


