#!/usr/bin/env python3
import os
import json
import shutil
import sys
import subprocess
import re
import signal
import time
import glob
import MySQLdb
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set, Union

# Configuration paths
ETC_UNBOUND_DIR = "/etc/darkflows/unbound"
DEFAULT_DIR = os.path.join(ETC_UNBOUND_DIR, "default")
TEMPLATE_DIR = "/usr/local/darkflows/templates/unbound"
VLANS_JSON = "/etc/darkflows/vlans.json"
NETWORK_CONFIG = "/etc/darkflows/d_network.cfg"
RUN_UNBOUND_SCRIPT = "/usr/local/darkflows/bin/run_unbound.py"
LOG_DIR = "/var/log"

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "passwd": "",  # Update if needed
}
DB_NAME = "unbound"
DNS_QUERIES_TABLE = "dns_queries"
BLACKLIST_TABLE = "blacklist"
WHITELIST_TABLE = "whitelist"
BLOCKLISTS_TABLE = "blocklists"

def disable_apparmor_for_unbound() -> None:
    """
    Disable AppArmor for Unbound to prevent permission issues.
    This function creates a symlink in the AppArmor disable directory and reloads the AppArmor profile.
    """
    try:
        # Check if the AppArmor profile exists
        apparmor_profile = "/etc/apparmor.d/usr.sbin.unbound"
        apparmor_disable_dir = "/etc/apparmor.d/disable"
        
        if not os.path.exists(apparmor_profile):
            print("AppArmor profile for Unbound not found, skipping AppArmor disabling")
            return
        
        # Create the disable directory if it doesn't exist
        if not os.path.exists(apparmor_disable_dir):
            print(f"Creating AppArmor disable directory: {apparmor_disable_dir}")
            os.makedirs(apparmor_disable_dir, exist_ok=True)
        
        # Create the symlink if it doesn't exist
        symlink_path = os.path.join(apparmor_disable_dir, "usr.sbin.unbound")
        if not os.path.exists(symlink_path):
            print("Creating symlink to disable AppArmor for Unbound")
            os.symlink(apparmor_profile, symlink_path)
        else:
            print("AppArmor symlink for Unbound already exists")
        
        # Reload the AppArmor profile
        print("Reloading AppArmor profile for Unbound")
        subprocess.run(["apparmor_parser", "-R", apparmor_profile], check=False)
        
        print("Successfully disabled AppArmor for Unbound")
    except Exception as e:
        print(f"Warning: Failed to disable AppArmor for Unbound: {e}", file=sys.stderr)
        print("Continuing anyway, but this might cause permission issues")

def ensure_directory_exists(directory_path: str) -> None:
    """
    Ensure that the specified directory exists.
    
    Args:
        directory_path: Path to the directory to check/create
    """
    if not os.path.exists(directory_path):
        print(f"Creating directory: {directory_path}")
        os.makedirs(directory_path, exist_ok=True)
        
        # Set ownership to unbound user
        try:
            subprocess.run(f"chown unbound:unbound {directory_path}", shell=True, check=True)
            print(f"Set ownership of {directory_path} to unbound user")
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to set ownership of {directory_path}: {e}", file=sys.stderr)
            print("Continuing anyway, but this might cause permission issues")

def copy_template_to_directory(source_dir: str, target_dir: str) -> None:
    """
    Copy template directory contents to the target directory.
    
    Args:
        source_dir: Source template directory
        target_dir: Target directory to copy to
    """
    if not os.path.exists(source_dir):
        print(f"Error: Template directory {source_dir} does not exist", file=sys.stderr)
        sys.exit(1)
        
    print(f"Copying template from {source_dir} to {target_dir}")
    
    # Use copytree with dirs_exist_ok=True for Python 3.8+
    # For older Python versions, we need to handle existing directories manually
    try:
        # For Python 3.8+
        shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)
    except TypeError:
        # For older Python versions
        if os.path.exists(target_dir):
            for item in os.listdir(source_dir):
                source_item = os.path.join(source_dir, item)
                target_item = os.path.join(target_dir, item)
                
                if os.path.isdir(source_item):
                    if not os.path.exists(target_item):
                        shutil.copytree(source_item, target_item)
                else:
                    shutil.copy2(source_item, target_item)
        else:
            shutil.copytree(source_dir, target_dir)
    
    # Set ownership of the target directory and all its contents to unbound user
    try:
        subprocess.run(f"chown -R unbound:unbound {target_dir}", shell=True, check=True)
        print(f"Set ownership of {target_dir} and its contents to unbound user")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to set ownership of {target_dir}: {e}", file=sys.stderr)
        print("Continuing anyway, but this might cause permission issues")

def init_database() -> None:
    """
    Initialize the database and tables if they don't exist.
    Checks table structure and recreates tables if they don't match expected structure.
    """
    try:
        # Try to connect to the database
        try:
            conn = MySQLdb.connect(db=DB_NAME, **DB_CONFIG)
            print(f"Connected to existing database '{DB_NAME}'")
        except MySQLdb.OperationalError as e:
            # Database doesn't exist, create it
            if e.args[0] == 1049:  # Database doesn't exist error code
                conn = MySQLdb.connect(**DB_CONFIG)
                cursor = conn.cursor()
                cursor.execute(f"CREATE DATABASE {DB_NAME} DEFAULT CHARACTER SET 'utf8'")
                conn.commit()
                print(f"Created database '{DB_NAME}'")
                cursor.close()
                conn.close()
                conn = MySQLdb.connect(db=DB_NAME, **DB_CONFIG)
            else:
                raise
        
        cursor = conn.cursor()
        
        # Define expected table structures with all required columns and indexes
        expected_tables = {
            DNS_QUERIES_TABLE: """
                CREATE TABLE {table} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ts DATETIME NOT NULL,
                    client_ip VARCHAR(45),
                    domain VARCHAR(255),
                    query_type VARCHAR(20) DEFAULT 'unknown',
                    status VARCHAR(20),
                    vlan_id INT NOT NULL DEFAULT 0,
                    KEY idx_ts (ts),
                    KEY idx_domain (domain),
                    KEY idx_client_ip (client_ip),
                    KEY idx_vlan_id (vlan_id),
                    KEY idx_ts_domain (ts, domain),
                    KEY idx_ts_client (ts, client_ip),
                    KEY idx_ts_vlan (ts, vlan_id)
                ) ENGINE=InnoDB
            """,
            BLACKLIST_TABLE: """
                CREATE TABLE {table} (
                    domain VARCHAR(255) NOT NULL,
                    vlan_id INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (domain, vlan_id)
                ) ENGINE=InnoDB
            """,
            WHITELIST_TABLE: """
                CREATE TABLE {table} (
                    domain VARCHAR(255) NOT NULL,
                    vlan_id INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (domain, vlan_id)
                ) ENGINE=InnoDB
            """,
            BLOCKLISTS_TABLE: """
                CREATE TABLE {table} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    url VARCHAR(2048) NOT NULL,
                    vlan_id INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY idx_name_vlan (name, vlan_id)
                ) ENGINE=InnoDB
            """
        }
        
        # Check and create/recreate each table
        for table_name, create_sql in expected_tables.items():
            # Check if table exists
            cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
            table_exists = cursor.fetchone() is not None
            
            if table_exists:
                # Check table structure
                cursor.execute(f"DESCRIBE {table_name}")
                columns = {row[0]: row for row in cursor.fetchall()}
                
                # Check for indexes
                cursor.execute(f"SHOW INDEX FROM {table_name}")
                indexes = {row[2]: row for row in cursor.fetchall()}
                
                # For dns_queries table, check for all required columns and indexes
                if table_name == DNS_QUERIES_TABLE:
                    required_columns = ['id', 'ts', 'client_ip', 'domain', 'query_type', 'status', 'vlan_id']
                    required_indexes = ['PRIMARY', 'idx_ts', 'idx_domain', 'idx_client_ip', 'idx_vlan_id', 
                                       'idx_ts_domain', 'idx_ts_client', 'idx_ts_vlan']
                    
                    missing_columns = [col for col in required_columns if col not in columns]
                    missing_indexes = [idx for idx in required_indexes if idx not in indexes]
                    
                    if missing_columns or missing_indexes:
                        print(f"Table {table_name} is missing required columns or indexes. Recreating...")
                        cursor.execute(f"DROP TABLE {table_name}")
                        cursor.execute(create_sql.format(table=table_name))
                        conn.commit()
                        print(f"Recreated table {table_name} with proper structure")
                    else:
                        print(f"Table {table_name} has correct structure")
                
                # For blacklist and whitelist tables, check for vlan_id column and primary key
                elif table_name in [BLACKLIST_TABLE, WHITELIST_TABLE]:
                    if 'vlan_id' not in columns or 'domain' not in columns:
                        print(f"Table {table_name} is missing required columns. Recreating...")
                        cursor.execute(f"DROP TABLE {table_name}")
                        cursor.execute(create_sql.format(table=table_name))
                        conn.commit()
                        print(f"Recreated table {table_name} with proper structure")
                    else:
                        # Check if primary key includes both domain and vlan_id
                        has_correct_pk = False
                        for idx_name, idx_row in indexes.items():
                            if idx_name == 'PRIMARY' and idx_row[4] == 1:  # Check if it's the first column in PK
                                # Need to check if vlan_id is also part of the PK
                                cursor.execute(f"SHOW INDEX FROM {table_name} WHERE Key_name = 'PRIMARY' AND Column_name = 'vlan_id'")
                                if cursor.fetchone():
                                    has_correct_pk = True
                        
                        if not has_correct_pk:
                            print(f"Table {table_name} has incorrect primary key. Recreating...")
                            cursor.execute(f"DROP TABLE {table_name}")
                            cursor.execute(create_sql.format(table=table_name))
                            conn.commit()
                            print(f"Recreated table {table_name} with proper structure")
                        else:
                            print(f"Table {table_name} has correct structure")
                
                # For blocklists table, check for all required columns and unique index
                elif table_name == BLOCKLISTS_TABLE:
                    required_columns = ['id', 'name', 'url', 'vlan_id', 'created_at', 'updated_at']
                    missing_columns = [col for col in required_columns if col not in columns]
                    
                    # Check for unique index on name and vlan_id
                    has_unique_index = False
                    for idx_name, idx_row in indexes.items():
                        if idx_name == 'idx_name_vlan':
                            has_unique_index = True
                            break
                    
                    if missing_columns or not has_unique_index:
                        print(f"Table {table_name} is missing required columns or indexes. Recreating...")
                        cursor.execute(f"DROP TABLE {table_name}")
                        cursor.execute(create_sql.format(table=table_name))
                        conn.commit()
                        print(f"Recreated table {table_name} with proper structure")
                    else:
                        print(f"Table {table_name} has correct structure")
            else:
                # Table doesn't exist, create it
                print(f"Creating table {table_name}")
                cursor.execute(create_sql.format(table=table_name))
                conn.commit()
        
        cursor.close()
        conn.close()
        print("Database initialization completed successfully")
    except Exception as e:
        print(f"Error initializing database: {e}", file=sys.stderr)
        sys.exit(1)

def read_network_config() -> Dict[str, str]:
    """
    Read the darkflows network configuration file.
    
    Returns:
        Dictionary containing the network configuration
    """
    config = {}
    try:
        with open(NETWORK_CONFIG, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    config[key.strip()] = value.strip().strip('"').strip("'")
        return config
    except Exception as e:
        print(f"Error reading network configuration: {e}", file=sys.stderr)
        return {}

def get_interface_ip(interface_name: str) -> Optional[str]:
    """
    Get the IP address of the specified interface.
    
    Args:
        interface_name: Name of the network interface
        
    Returns:
        IP address of the interface or None if not found
    """
    try:
        # Run ip addr command to get interface information
        result = subprocess.run(
            ['ip', 'addr', 'show', interface_name], 
            capture_output=True, 
            text=True, 
            check=True
        )
        
        # Parse the output to find the IP address
        output = result.stdout
        # Look for IPv4 address pattern
        ip_match = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)/\d+', output)
        
        if ip_match:
            return ip_match.group(1)
        else:
            print(f"Warning: No IP address found for interface {interface_name}", file=sys.stderr)
            return None
    except subprocess.CalledProcessError as e:
        print(f"Error getting IP for interface {interface_name}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Unexpected error getting IP for interface {interface_name}: {e}", file=sys.stderr)
        return None

def get_vlan_interface_ip(vlan_id: str) -> Optional[str]:
    """
    Get the IP address of a VLAN interface.
    
    Args:
        vlan_id: VLAN ID
        
    Returns:
        IP address of the VLAN interface or None if not found
    """
    # VLAN interfaces are typically named like br1.10 for VLAN 10
    network_config = read_network_config()
    internal_interface = network_config.get('INTERNAL_INTERFACE', 'br1')
    vlan_interface = f"{internal_interface}.{vlan_id}"
    
    return get_interface_ip(vlan_interface)

def update_unbound_conf(config_dir: str, interface_ip: Optional[str] = None) -> None:
    """
    Update the unbound.conf file to use the correct directory paths and interface IP.
    
    Args:
        config_dir: The directory containing the unbound.conf file
        interface_ip: IP address to bind unbound to (if None, use 0.0.0.0)
    """
    conf_file = os.path.join(config_dir, "unbound.conf")
    if not os.path.exists(conf_file):
        print(f"Warning: unbound.conf not found in {config_dir}", file=sys.stderr)
        return
    
    print(f"Updating configuration file: {conf_file}")
    
    # Read the current content
    with open(conf_file, 'r') as f:
        lines = f.readlines()
    
    # Process each line
    updated_lines = []
    server_section = False
    interface_found = False
    include_dirs = set()
    
    # Track if we've seen the blacklists.d include directive
    blacklists_include_found = False
    
    for line in lines:
        # Check for include-toplevel directives to identify directories to create
        if 'include-toplevel:' in line and not line.strip().startswith('#'):
            # Check if this is the blacklists.d include
            if 'blacklists.d' in line:
                blacklists_include_found = True
            
            # Extract the directory path from the include directive
            # Format is typically: include-toplevel: "/path/to/dir/*.conf"
            match = re.search(r'"([^"]+)"', line)
            if match:
                include_path = match.group(1)
                # Extract directory part (remove the /*.conf part)
                if '/*' in include_path:
                    include_dir = include_path.split('/*')[0]
                    # If it's an absolute path starting with /etc/unbound
                    if include_dir.startswith('/etc/unbound'):
                        # Convert to config_dir-relative path
                        relative_dir = include_dir.replace('/etc/unbound', config_dir)
                        include_dirs.add(relative_dir)
        
        # Replace any instances of /etc/unbound with the correct path
        if '/etc/unbound' in line:
            line = line.replace('/etc/unbound', config_dir)
        
        # Track if we're in the server section
        if 'server:' in line and not line.strip().startswith('#'):
            server_section = True
        
        # Check for interface line
        if server_section and 'interface:' in line and not line.strip().startswith('#'):
            if interface_ip:
                # Replace the interface line
                line = f"    interface: {interface_ip}\n"
            interface_found = True
        
        updated_lines.append(line)
    
    # Add interface line if not found and IP is provided
    if interface_ip and not interface_found and server_section:
        # Find where to insert the interface line (after server: line)
        for i, line in enumerate(updated_lines):
            if 'server:' in line and not line.strip().startswith('#'):
                # Insert after the server: line
                updated_lines.insert(i + 1, f"    interface: {interface_ip}\n")
                break
    
    # Add the blacklists.d include directive if it's missing
    if not blacklists_include_found:
        # Find the last include-toplevel directive
        last_include_index = -1
        for i, line in enumerate(updated_lines):
            if 'include-toplevel:' in line and not line.strip().startswith('#'):
                last_include_index = i
        
        if last_include_index >= 0:
            # Add the blacklists.d include after the last include directive
            blacklists_include = f"    include-toplevel: \"{config_dir}/blacklists.d/*.conf\"\n"
            updated_lines.insert(last_include_index + 1, blacklists_include)
            print(f"Added missing blacklists.d include directive")
            
            # Also add this directory to our list to create
            include_dirs.add(os.path.join(config_dir, "blacklists.d"))
    
    # Write the updated content back
    with open(conf_file, 'w') as f:
        f.writelines(updated_lines)
    
    # Create all the include directories
    for include_dir in include_dirs:
        if not os.path.exists(include_dir):
            print(f"Creating include directory: {include_dir}")
            os.makedirs(include_dir, exist_ok=True)
            
            # Set ownership to unbound user
            try:
                subprocess.run(f"chown unbound:unbound {include_dir}", shell=True, check=True)
                print(f"Set ownership of {include_dir} to unbound user")
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to set ownership of {include_dir}: {e}", file=sys.stderr)
    
    # Set ownership of the configuration file to unbound user
    try:
        subprocess.run(f"chown unbound:unbound {conf_file}", shell=True, check=True)
        print(f"Set ownership of {conf_file} to unbound user")
    except subprocess.CalledProcessError as e:
        print(f"Warning: Failed to set ownership of {conf_file}: {e}", file=sys.stderr)
    
    print(f"Updated configuration paths in {conf_file}" + 
          (f" with interface IP: {interface_ip}" if interface_ip else "") +
          f" and created {len(include_dirs)} include directories")

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

def kill_unbound_processes() -> None:
    """
    Kill all running unbound processes, which will also terminate their parent screen sessions.
    First tries to kill processes using PIDs from PID files, then falls back to more general methods.
    """
    try:
        # First, try to kill processes using PIDs from PID files
        print("Looking for PID files to terminate specific processes...")
        pid_files = []
        
        # Find all unbound.pid files in the ETC_UNBOUND_DIR and its subdirectories
        for root, dirs, files in os.walk(ETC_UNBOUND_DIR):
            for file in files:
                if file == "unbound.pid":
                    pid_files.append(os.path.join(root, file))
        
        if pid_files:
            print(f"Found {len(pid_files)} PID files")
            for pid_file in pid_files:
                try:
                    with open(pid_file, 'r') as f:
                        pid_data = {}
                        for line in f:
                            if ':' in line:
                                key, value = line.strip().split(':', 1)
                                pid_data[key] = value
                    
                    # Try to kill the unbound process first
                    if 'unbound_pid' in pid_data:
                        unbound_pid = pid_data['unbound_pid']
                        print(f"Killing Unbound process with PID {unbound_pid} from {pid_file}")
                        try:
                            subprocess.run(f"kill -9 {unbound_pid}", shell=True, check=False)
                        except Exception as e:
                            print(f"Error killing Unbound process {unbound_pid}: {e}", file=sys.stderr)
                    
                    # Then kill the Python process
                    if 'python_pid' in pid_data:
                        python_pid = pid_data['python_pid']
                        print(f"Killing Python process with PID {python_pid} from {pid_file}")
                        try:
                            subprocess.run(f"kill -9 {python_pid}", shell=True, check=False)
                        except Exception as e:
                            print(f"Error killing Python process {python_pid}: {e}", file=sys.stderr)
                    
                    # Finally, kill the screen session
                    if 'screen_session' in pid_data:
                        screen_session = pid_data['screen_session']
                        print(f"Killing screen session {screen_session} from {pid_file}")
                        try:
                            subprocess.run(f"screen -S {screen_session} -X quit", shell=True, check=False)
                        except Exception as e:
                            print(f"Error killing screen session {screen_session}: {e}", file=sys.stderr)
                    
                except Exception as e:
                    print(f"Error processing PID file {pid_file}: {e}", file=sys.stderr)
        else:
            print("No PID files found")
        
        # Wait a moment to ensure processes are terminated
        time.sleep(2)
        
        # Now use killall as a fallback to directly kill any remaining unbound processes
        print("Using killall to terminate any remaining unbound processes...")
        try:
            subprocess.run("killall -9 unbound", shell=True, check=False)
            print("Executed killall command for unbound")
        except Exception as e:
            print(f"Error executing killall command: {e}", file=sys.stderr)
        
        # Wait a moment to ensure processes are terminated
        time.sleep(2)
        
        # Now find and kill any remaining python run_unbound.py processes
        print("Checking for remaining run_unbound.py processes...")
        ps_cmd = "ps -eo pid,ppid,cmd | grep 'run_unbound.py' | grep -v grep"
        ps_result = subprocess.run(ps_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if ps_result.stdout.strip():
            print("Found run_unbound.py processes to kill:")
            print(ps_result.stdout)
            
            # Extract PIDs and kill them
            for line in ps_result.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 1:
                    pid = parts[0]
                    try:
                        print(f"Killing run_unbound.py process with PID {pid}")
                        subprocess.run(f"kill -9 {pid}", shell=True, check=False)
                    except Exception as e:
                        print(f"Error killing process {pid}: {e}", file=sys.stderr)
        
        # Verify all processes are killed
        print("Verifying all unbound processes are killed...")
        ps_cmd = "ps -eo pid,ppid,cmd | grep -E '(/usr/sbin/unbound -d|run_unbound.py)' | grep -v grep"
        ps_result = subprocess.run(ps_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if ps_result.stdout.strip():
            print("Warning: Some unbound processes are still running:")
            print(ps_result.stdout)
            print("Attempting to kill remaining processes forcefully...")
            
            # Extract PIDs and kill them
            for line in ps_result.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 1:
                    pid = parts[0]
                    try:
                        print(f"Forcefully killing process with PID {pid}")
                        subprocess.run(f"kill -9 {pid}", shell=True, check=False)
                    except Exception as e:
                        print(f"Error killing process {pid}: {e}", file=sys.stderr)
        else:
            print("All unbound processes successfully terminated")
        
        # Check if any screen sessions are still running
        print("Checking for any remaining unbound screen sessions...")
        screen_cmd = "screen -ls | grep unbound_"
        screen_result = subprocess.run(screen_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if screen_result.stdout.strip():
            print("Warning: Some unbound screen sessions are still running:")
            print(screen_result.stdout)
            print("Attempting to kill remaining screen sessions...")
            
            # Extract screen names and kill them
            for line in screen_result.stdout.splitlines():
                if 'unbound_' in line:
                    parts = line.strip().split()
                    for part in parts:
                        if 'unbound_' in part:
                            screen_name = part.split('.')[-1]
                            try:
                                print(f"Killing screen session: {screen_name}")
                                kill_cmd = f"screen -S {screen_name} -X quit"
                                subprocess.run(kill_cmd, shell=True, check=False)
                            except Exception as e:
                                print(f"Error killing screen session {screen_name}: {e}", file=sys.stderr)
        else:
            print("No remaining unbound screen sessions found")
            
    except Exception as e:
        print(f"Error managing unbound processes: {e}", file=sys.stderr)

def run_unbound_process(config_dir: str, config_name: str, vlan_id: int = 0) -> Optional[int]:
    """
    Run an unbound process for the specified configuration using screen.
    
    Args:
        config_dir: The directory containing the unbound configuration
        config_name: Name of the configuration (e.g., 'default' or VLAN ID)
        vlan_id: VLAN ID (0 for default)
        
    Returns:
        Process ID of the started process, or None if failed
    """
    screen_name = f"unbound_{config_name}"
    log_file = os.path.join(LOG_DIR, f"{screen_name}.log")
    pid_file = os.path.join(config_dir, "unbound.pid")
    config_file = os.path.join(config_dir, "unbound.conf")
    
    # Verify that the configuration file exists, if not copy the template
    if not os.path.exists(config_file):
        print(f"Configuration file {config_file} does not exist, copying template", file=sys.stderr)
        
        # Ensure the directory exists
        ensure_directory_exists(config_dir)
        
        # Copy template to the directory
        copy_template_to_directory(TEMPLATE_DIR, config_dir)
        
        # Get the appropriate IP address based on VLAN ID
        if vlan_id == 0:
            # For default instance, use internal interface IP
            network_config = read_network_config()
            internal_interface = network_config.get('INTERNAL_INTERFACE', 'br1')
            interface_ip = get_interface_ip(internal_interface)
        else:
            # For VLAN instance, use VLAN interface IP
            interface_ip = get_vlan_interface_ip(str(vlan_id))
        
        # Update the configuration with the correct IP
        update_unbound_conf(config_dir, interface_ip)
        
        # Verify again that the configuration file exists after copying
        if not os.path.exists(config_file):
            print(f"Error: Failed to create configuration file {config_file} from template", file=sys.stderr)
            return None
    
    try:
        # Change ownership of the configuration directory to unbound user
        print(f"Changing ownership of {config_dir} to unbound user")
        try:
            subprocess.run(f"chown -R unbound:unbound {config_dir}", shell=True, check=True)
            print(f"Successfully changed ownership of {config_dir} to unbound user")
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to change ownership of {config_dir}: {e}", file=sys.stderr)
            print("Continuing anyway, but this might cause permission issues")
        
        # First check if a screen with this name already exists
        check_screen_cmd = f"screen -ls | grep {screen_name}"
        result = subprocess.run(check_screen_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if screen_name in result.stdout:
            print(f"Screen session {screen_name} already exists, killing it first")
            kill_screen_cmd = f"screen -S {screen_name} -X quit"
            subprocess.run(kill_screen_cmd, shell=True, check=False)
            time.sleep(1)  # Give it time to terminate
        
        # Prepare environment variables for the unbound process
        env = os.environ.copy()
        env['UNBOUND_DB_NAME'] = DB_NAME
        
        # Start a new screen session with the VLAN ID as a command line argument
        # and pass the configuration file path
        # Note: run_unbound.py uses the -p flag with unbound to prevent it from creating its own PID file
        screen_cmd = [
            '/usr/bin/screen',
            '-dmS',
            screen_name,
            '/usr/bin/python3',
            RUN_UNBOUND_SCRIPT,
            f'--vlan-id={vlan_id}',
            f'--config={config_file}'
        ]
        
        print(f"Starting screen session: {' '.join(screen_cmd)}")
        subprocess.run(screen_cmd, check=True, env=env)
        
        # Wait a moment for the process to start
        time.sleep(2)
        
        # Find the screen session PID
        screen_pid_cmd = f"screen -ls | grep {screen_name} | cut -d. -f1 | awk '{{print $1}}'"
        screen_pid_result = subprocess.run(screen_pid_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        screen_pid = screen_pid_result.stdout.strip()
        
        # Find the Python process PID (run_unbound.py)
        python_pid = None
        python_pid_cmd = f"ps -eo pid,cmd | grep 'python.*run_unbound.py.*--vlan-id={vlan_id}' | grep -v grep"
        python_pid_result = subprocess.run(python_pid_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if python_pid_result.stdout.strip():
            python_pid_line = python_pid_result.stdout.strip().split('\n')[0]
            python_pid = python_pid_line.strip().split()[0]
            print(f"Found Python process (run_unbound.py) with PID: {python_pid}")
        
        # Find the actual Unbound process PID
        unbound_pid = None
        # Wait a bit more to ensure unbound has started
        time.sleep(3)
        
        # Try to find the unbound process
        unbound_pid_cmd = "ps -eo pid,ppid,cmd | grep '/usr/sbin/unbound -d' | grep -v grep"
        unbound_pid_result = subprocess.run(unbound_pid_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if unbound_pid_result.stdout.strip():
            # We need to find the unbound process that corresponds to our VLAN
            # This is tricky since there might be multiple unbound processes
            # We'll look for the one that has the config file in its command line
            
            for line in unbound_pid_result.stdout.strip().split('\n'):
                parts = line.strip().split()
                pid = parts[0]
                ppid = parts[1]
                
                # Check if this unbound process is using our config file
                # We can do this by checking if the Python process is its parent
                if python_pid and ppid == python_pid:
                    unbound_pid = pid
                    print(f"Found Unbound process with PID: {unbound_pid} (parent: {ppid})")
                    break
            
            # If we couldn't match by parent PID, try to match by config file
            if not unbound_pid:
                # Get the command line for each unbound process
                for line in unbound_pid_result.stdout.strip().split('\n'):
                    parts = line.strip().split()
                    pid = parts[0]
                    
                    # Check the command line arguments
                    cmd_line_cmd = f"ps -p {pid} -o args="
                    cmd_line_result = subprocess.run(cmd_line_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    cmd_line = cmd_line_result.stdout.strip()
                    
                    # If the config file is in the command line, this is our process
                    if config_file in cmd_line:
                        unbound_pid = pid
                        print(f"Found Unbound process with PID: {unbound_pid} using config: {config_file}")
                        break
        
        # If we still don't have an unbound PID, try one more approach - look at processes started recently
        if not unbound_pid:
            # Get all unbound processes sorted by start time (newest first)
            unbound_pid_cmd = "ps -eo pid,lstart,cmd | grep '/usr/sbin/unbound -d' | grep -v grep | sort -k2,5 -r"
            unbound_pid_result = subprocess.run(unbound_pid_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            if unbound_pid_result.stdout.strip():
                # Take the most recently started unbound process
                newest_line = unbound_pid_result.stdout.strip().split('\n')[0]
                unbound_pid = newest_line.strip().split()[0]
                print(f"Using most recently started Unbound process with PID: {unbound_pid}")
        
        if screen_pid:
            # Make sure the PID file is writable by changing its ownership back to root
            try:
                subprocess.run(f"chown root:root {pid_file}", shell=True, check=False)
            except Exception as e:
                print(f"Warning: Failed to change ownership of PID file: {e}", file=sys.stderr)
            
            # Write the PIDs to the PID file
            with open(pid_file, 'w') as f:
                f.write(f"screen_session:{screen_name}\n")
                f.write(f"screen_pid:{screen_pid}\n")
                if python_pid:
                    f.write(f"python_pid:{python_pid}\n")
                if unbound_pid:
                    f.write(f"unbound_pid:{unbound_pid}\n")
                f.write(f"vlan_id:{vlan_id}\n")
                f.write(f"config_file:{config_file}\n")
            
            print(f"Started unbound process for {config_name} in screen session {screen_name} with VLAN ID {vlan_id} using config {config_file}")
            print(f"PIDs - Screen: {screen_pid}, Python: {python_pid}, Unbound: {unbound_pid}")
            
            # Return the unbound PID if available, otherwise the screen PID
            return int(unbound_pid) if unbound_pid and unbound_pid.isdigit() else (
                int(screen_pid) if screen_pid.isdigit() else None)
        
        print(f"Warning: Could not find screen session for {screen_name}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error starting unbound process for {config_name}: {e}", file=sys.stderr)
        return None

def main() -> None:
    """
    Main function to check directories and copy templates.
    Always kills existing unbound processes and starts all instances.
    """
    # Disable AppArmor for Unbound
    disable_apparmor_for_unbound()
    
    # Kill any existing unbound processes
    kill_unbound_processes()
    
    # Initialize the database
    init_database()
    
    # Read network configuration to get internal interface
    network_config = read_network_config()
    internal_interface = network_config.get('INTERNAL_INTERFACE')
    
    if not internal_interface:
        print("Warning: Internal interface not found in network configuration", file=sys.stderr)
        internal_interface = 'br1'  # Default fallback
    
    # Get the IP address of the internal interface
    internal_ip = get_interface_ip(internal_interface)
    if not internal_ip:
        print(f"Warning: Could not determine IP for internal interface {internal_interface}", file=sys.stderr)
    
    # Ensure the main unbound directory exists
    ensure_directory_exists(ETC_UNBOUND_DIR)
    
    # Handle default unbound instance
    ensure_directory_exists(DEFAULT_DIR)
    
    # Start the default unbound process
    # run_unbound_process will check for unbound.conf and copy template if needed
    run_unbound_process(DEFAULT_DIR, "default", 0)
    
    # Read the VLANS configuration
    try:
        vlans = read_vlans_json()
        
        # Create directories for each VLAN and copy templates
        for vlan in vlans:
            vlan_id = int(vlan.get('id', 0))
            vlan_dir = os.path.join(ETC_UNBOUND_DIR, str(vlan_id))
            
            # Ensure the VLAN directory exists
            ensure_directory_exists(vlan_dir)
            
            # Start the VLAN unbound process
            # run_unbound_process will check for unbound.conf and copy template if needed
            run_unbound_process(vlan_dir, str(vlan_id), vlan_id)
        
        print("Unbound directory setup and processes started successfully")
        
    except Exception as e:
        print(f"Error processing VLAN configuration: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 
