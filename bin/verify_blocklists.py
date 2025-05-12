#!/usr/bin/env python3
import os
import json
import sys
import subprocess
import shutil
import MySQLdb
from typing import List, Dict, Optional, Tuple, Set

# Configuration paths
ETC_UNBOUND_DIR = "/etc/darkflows/unbound"
DEFAULT_DIR = os.path.join(ETC_UNBOUND_DIR, "default")
VLANS_JSON = "/etc/darkflows/vlans.json"
FETCH_BLOCKLIST_SCRIPT = "/usr/local/darkflows/bin/fetch_blocklist.py"
DNS_MANAGER_SCRIPT = "/usr/local/darkflows/bin/unbound-dns-manager.py"


# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "passwd": "",  # Update if needed
}
DB_NAME = "unbound"
BLOCKLISTS_TABLE = "blocklists"

def ensure_directory_exists(directory_path: str) -> None:
    """
    Ensure that the specified directory exists.
    
    Args:
        directory_path: Path to the directory to check/create
    """
    if not os.path.exists(directory_path):
        print(f"Creating directory: {directory_path}")
        os.makedirs(directory_path, exist_ok=True)

def read_vlans_json() -> List[Dict]:
    """
    Read and parse the VLANS configuration file.
    
    Returns:
        List of VLAN configurations
    """
    try:
        with open(VLANS_JSON, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading VLANS configuration: {e}", file=sys.stderr)
        sys.exit(1)

def get_blocklists_from_db(vlan_id: Optional[int] = None) -> List[Dict]:
    """
    Get blocklists from the database for a specific VLAN ID.
    
    Args:
        vlan_id: The VLAN ID to get blocklists for, or None for all VLANs
        
    Returns:
        List of blocklists with name, url, and vlan_id
    """
    try:
        conn = MySQLdb.connect(db=DB_NAME, **DB_CONFIG)
        cursor = conn.cursor(MySQLdb.cursors.DictCursor)
        
        if vlan_id is not None:
            if vlan_id == 0:
                # For default VLAN, get blocklists for VLAN ID 0 or 1
                query = f"SELECT id, name, url, vlan_id FROM {BLOCKLISTS_TABLE} WHERE vlan_id IN (0, 1)"
                cursor.execute(query)
            else:
                query = f"SELECT id, name, url, vlan_id FROM {BLOCKLISTS_TABLE} WHERE vlan_id = %s"
                cursor.execute(query, (vlan_id,))
        else:
            query = f"SELECT id, name, url, vlan_id FROM {BLOCKLISTS_TABLE}"
            cursor.execute(query)
            
        blocklists = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return blocklists
    except Exception as e:
        print(f"Error getting blocklists from database: {e}", file=sys.stderr)
        sys.exit(1)

def get_blocklists_from_db_old(vlan_id: Optional[int] = None) -> List[Dict]:
    """
    Get blocklists from the database for a specific VLAN ID.
    
    Args:
        vlan_id: The VLAN ID to get blocklists for, or None for all VLANs
        
    Returns:
        List of blocklists with name, url, and vlan_id
    """
    try:
        conn = MySQLdb.connect(db=DB_NAME, **DB_CONFIG)
        cursor = conn.cursor(MySQLdb.cursors.DictCursor)
        
        if vlan_id is not None:
            query = f"SELECT id, name, url, vlan_id FROM {BLOCKLISTS_TABLE} WHERE vlan_id = %s"
            cursor.execute(query, (vlan_id,))
        else:
            query = f"SELECT id, name, url, vlan_id FROM {BLOCKLISTS_TABLE}"
            cursor.execute(query)
            
        blocklists = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return blocklists
    except Exception as e:
        print(f"Error getting blocklists from database: {e}", file=sys.stderr)
        sys.exit(1)

def clear_blocklists_directory(vlan_id: Optional[int] = None) -> None:
    """
    Clear all blocklists in the blacklists.d directory for a specific VLAN.
    
    Args:
        vlan_id: The VLAN ID to clear blocklists for, or None for default VLAN
    """
    if vlan_id is None or vlan_id == 0:
        blocklists_dir = os.path.join(DEFAULT_DIR, "blacklists.d")
    else:
        blocklists_dir = os.path.join(ETC_UNBOUND_DIR, str(vlan_id), "blacklists.d")
    
    if os.path.exists(blocklists_dir):
        print(f"Clearing blocklists directory: {blocklists_dir}")
        for file in os.listdir(blocklists_dir):
            if file.endswith(".conf"):
                file_path = os.path.join(blocklists_dir, file)
                try:
                    os.remove(file_path)
                    print(f"Deleted: {file_path}")
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}", file=sys.stderr)
    else:
        print(f"Blocklists directory does not exist: {blocklists_dir}")
        ensure_directory_exists(blocklists_dir)

def update_blocklist(name: str, url: str, vlan_id: Optional[int] = None) -> bool:
    """
    Update a single blocklist by calling fetch_blocklist.py.
    
    Args:
        name: The name of the blocklist
        url: The URL of the blocklist
        vlan_id: The VLAN ID to update the blocklist for, or None for default VLAN
        
    Returns:
        True if the update was successful, False otherwise
    """
    # Build command with positional arguments for name and url
    cmd = [
        "python3",
        FETCH_BLOCKLIST_SCRIPT,
        name,  # Positional argument for name
        url    # Positional argument for url
    ]
    
    # Add vlan_id as a flag argument if provided
    if vlan_id is not None:
        cmd.append(f"--vlan-id={vlan_id}")
    
    try:
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"UPDATED: {vlan_id if vlan_id is not None else '0'} {name} {url}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error updating blocklist {name} for VLAN {vlan_id}: {e}", file=sys.stderr)
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False
    except Exception as e:
        print(f"Error updating blocklist {name} for VLAN {vlan_id}: {e}", file=sys.stderr)
        return False

def main() -> None:
    """
    Main function to verify and update blocklists for all VLANs.
    """
    # Process default VLAN (0)
    print("Processing default VLAN (0)...")
    clear_blocklists_directory(0)
    default_blocklists = get_blocklists_from_db(0)
    
    for blocklist in default_blocklists:
        update_blocklist(blocklist['name'], blocklist['url'], 0)
    
    # Read the VLANS configuration
    try:
        vlans = read_vlans_json()
        
        # Process each VLAN
        for vlan in vlans:
            vlan_id = int(vlan.get('id', 0))
            print(f"Processing VLAN {vlan_id}...")
            
            # Clear existing blocklists
            clear_blocklists_directory(vlan_id)
            
            # Get blocklists for this VLAN
            vlan_blocklists = get_blocklists_from_db(vlan_id)
            
            # Update each blocklist
            for blocklist in vlan_blocklists:
                update_blocklist(blocklist['name'], blocklist['url'], vlan_id)
        
        print("Blocklist verification and update completed successfully")
        
    except Exception as e:
        print(f"Error processing VLAN configuration: {e}", file=sys.stderr)
        sys.exit(1)

    # Trigger Unbound reload via your DNS manager script
    try:
        print("Triggering Unbound reload via DNS manager…")
        # If unbound-dns-manager.py is executable:
        subprocess.run([DNS_MANAGER_SCRIPT, "restart"], check=True)
        # Otherwise, explicitly invoke with python3:
        # subprocess.run(["python3", DNS_MANAGER_SCRIPT, "restart"], check=True)
        print("✅ DNS manager restart completed.")
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Failed to restart DNS manager: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 
