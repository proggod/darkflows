#!/usr/bin/env python3
import subprocess
import time
import os
import sys
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
import re
import fcntl
import struct

@dataclass
class NetworkInterface:
    name: str
    bandwidth_ingress: str  # Keep as string to preserve units (mbit, gbit)
    bandwidth_egress: str
    label: str
    is_primary: bool = False
    is_secondary: bool = False
    is_internal: bool = False

class NetworkManager:
    def __init__(self, config_path: str = "/etc/darkflows/d_network.cfg"):
        self.logger = self._setup_logging()
        self.interfaces: Dict[str, NetworkInterface] = {}
        self.config = {}
        self.load_config(config_path)
        self.setup_interfaces()
        self.setup_ifb()
        
    def _setup_logging(self) -> logging.Logger:
        """Configure logging with both file and console output"""
        logger = logging.getLogger("NetworkManager")
        logger.setLevel(logging.DEBUG)
        
        # Console handler with colored output
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        
        # Define color codes
        colors = {
            'DEBUG': '\033[94m',    # Blue
            'INFO': '\033[92m',     # Green
            'WARNING': '\033[93m',  # Yellow
            'ERROR': '\033[91m',    # Red
            'CRITICAL': '\033[95m', # Purple
            'ENDC': '\033[0m'       # Reset
        }
        
        class ColorFormatter(logging.Formatter):
            def format(self, record):
                if record.levelname in colors:
                    record.levelname = f"{colors[record.levelname]}{record.levelname}{colors['ENDC']}"
                return super().format(record)
        
        # Set formatters
        console_formatter = ColorFormatter(
            '%(asctime)s [%(levelname)s] [%(funcName)s:%(lineno)d] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)
        
        # File handler
        file_handler = logging.FileHandler('/var/log/network_manager.log')
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] [%(funcName)s:%(lineno)d] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        
        # Add handlers
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)
        
        return logger

    def parse_bash_config(self, content: str) -> dict:
        """Parse bash-style configuration file"""
        config = {}
        self.logger.debug("Starting to parse configuration file")
        
        for line_num, line in enumerate(content.splitlines(), 1):
            original_line = line
            line = line.strip()
            
            if not line:
                self.logger.debug(f"Line {line_num}: Empty line - skipping")
                continue
                
            if line.startswith('#'):
                self.logger.debug(f"Line {line_num}: Comment line - skipping")
                continue
                
            # Look for key="value" patterns
            match = re.match(r'^(\w+)=[\'"]([^\'"]*)[\'"]$', line)
            if match:
                key, value = match.groups()
                config[key] = value
                self.logger.debug(f"Line {line_num}: Parsed configuration - {key}={value}")
            else:
                self.logger.warning(f"Line {line_num}: Unable to parse line format: {line}")
                
        self.logger.debug("Configuration parsing completed")
        self.logger.debug(f"Found {len(config)} configuration entries: {list(config.keys())}")
        return config

    def load_config(self, config_path: str):
        """Load network configuration from bash-style config file"""
        try:
            self.logger.debug(f"Loading configuration from {config_path}")
            with open(config_path, 'r') as f:
                content = f.read()
            self.config = self.parse_bash_config(content)
            self.logger.info("Configuration loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load config: {e}")
            sys.exit(1)

    def setup_interfaces(self):
        """Set up network interfaces from config"""
        self.logger.debug("Starting interface setup")
        
        # Primary Interface
        if 'PRIMARY_INTERFACE' in self.config:
            primary_if = self.config['PRIMARY_INTERFACE']
            self.logger.debug(f"Configuring Primary Interface: {primary_if}")
            self.logger.debug(f"  - Ingress Bandwidth: {self.config['PRIMARY_INGRESS_BANDWIDTH']}")
            self.logger.debug(f"  - Egress Bandwidth: {self.config['PRIMARY_EGRESS_BANDWIDTH']}")
            self.logger.debug(f"  - Label: {self.config['PRIMARY_LABEL']}")
            
            if not os.path.exists(f"/sys/class/net/{primary_if}"):
                self.logger.error(f"Primary interface {primary_if} does not exist!")
            else:
                self.interfaces[primary_if] = NetworkInterface(
                    name=primary_if,
                    bandwidth_ingress=self.config['PRIMARY_INGRESS_BANDWIDTH'],
                    bandwidth_egress=self.config['PRIMARY_EGRESS_BANDWIDTH'],
                    label=self.config['PRIMARY_LABEL'],
                    is_primary=True
                )
                self.logger.info(f"Primary interface {primary_if} configured successfully")

        # Secondary Interface (if configured)
        if 'SECONDARY_INTERFACE' in self.config and self.config['SECONDARY_INTERFACE']:
            secondary_if = self.config['SECONDARY_INTERFACE']
            self.logger.debug(f"Configuring Secondary Interface: {secondary_if}")
            
            if not os.path.exists(f"/sys/class/net/{secondary_if}"):
                self.logger.error(f"Secondary interface {secondary_if} does not exist!")
            else:
                self.interfaces[secondary_if] = NetworkInterface(
                    name=secondary_if,
                    bandwidth_ingress=self.config['SECONDARY_INGRESS_BANDWIDTH'],
                    bandwidth_egress=self.config['SECONDARY_EGRESS_BANDWIDTH'],
                    label=self.config['SECONDARY_LABEL'],
                    is_secondary=True
                )
                self.logger.info(f"Secondary interface {secondary_if} configured successfully")

        # Internal Interface
        if 'INTERNAL_INTERFACE' in self.config:
            internal_if = self.config['INTERNAL_INTERFACE']
            self.logger.debug(f"Configuring Internal Interface: {internal_if}")
            
            if not os.path.exists(f"/sys/class/net/{internal_if}"):
                self.logger.error(f"Internal interface {internal_if} does not exist!")
            else:
                self.interfaces[internal_if] = NetworkInterface(
                    name=internal_if,
                    bandwidth_ingress=self.config['INTERNAL_INGRESS_BANDWIDTH'],
                    bandwidth_egress=self.config['INTERNAL_EGRESS_BANDWIDTH'],
                    label=self.config['INTERNAL_LABEL'],
                    is_internal=True
                )
                self.logger.info(f"Internal interface {internal_if} configured successfully")

    def setup_ifb(self):
        """Set up IFB interface for ingress traffic shaping"""
        self.logger.debug("Starting IFB setup")
        
        try:
            # Check if ifb module is already loaded
            lsmod_output = subprocess.run(['lsmod'], capture_output=True, text=True, check=True)
            if 'ifb' in lsmod_output.stdout:
                self.logger.debug("IFB module already loaded")
            else:
                self.logger.debug("Loading IFB module")
                subprocess.run(['modprobe', 'ifb'], check=True)
                self.logger.debug("IFB module loaded successfully")
            
            # Check if ifb0 exists
            if os.path.exists('/sys/class/net/ifb0'):
                self.logger.debug("Found existing ifb0 interface, removing it")
                result = subprocess.run(['ip', 'link', 'del', 'dev', 'ifb0'], 
                                     capture_output=True, text=True)
                if result.returncode == 0:
                    self.logger.debug("Successfully removed existing ifb0")
                else:
                    self.logger.warning(f"Failed to remove ifb0: {result.stderr}")
            
            # Create new ifb0
            self.logger.debug("Creating new ifb0 interface")
            subprocess.run(['ip', 'link', 'add', 'ifb0', 'type', 'ifb'], check=True)
            
            # Enable ifb0
            self.logger.debug("Enabling ifb0 interface")
            subprocess.run(['ip', 'link', 'set', 'ifb0', 'up'], check=True)
            
            # Verify ifb0 is up
            ip_link_output = subprocess.run(['ip', 'link', 'show', 'ifb0'], 
                                          capture_output=True, text=True, check=True)
            if 'state UP' in ip_link_output.stdout:
                self.logger.info("IFB setup completed successfully - interface is UP")
            else:
                self.logger.warning("IFB interface created but may not be UP")
                self.logger.debug(f"ip link output: {ip_link_output.stdout}")
            
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Failed to setup IFB: {e}")
            self.logger.debug(f"Command output: {e.output if hasattr(e, 'output') else 'No output'}")
            self.logger.debug(f"Command stderr: {e.stderr if hasattr(e, 'stderr') else 'No stderr'}")
            sys.exit(1)

    def get_interface_stats(self, iface_name: str) -> dict:
        """Get network interface statistics"""
        try:
            with open(f"/sys/class/net/{iface_name}/statistics/rx_bytes") as f:
                rx_bytes = int(f.read())
            with open(f"/sys/class/net/{iface_name}/statistics/tx_bytes") as f:
                tx_bytes = int(f.read())
            return {
                'rx_bytes': rx_bytes,
                'tx_bytes': tx_bytes,
                'timestamp': time.time()
            }
        except Exception as e:
            self.logger.error(f"Failed to get stats for {iface_name}: {e}")
            return {}

    def monitor_interfaces(self):
        """Monitor network interfaces and adjust CAKE parameters as needed"""
        prev_stats = {}
        monitoring_start_time = time.time()
        update_count = 0
        
        self.logger.debug("Starting interface monitoring")
        
        while True:
            update_count += 1
            current_time = time.time()
            elapsed_time = current_time - monitoring_start_time
            
            self.logger.debug(f"\n{'='*50}")
            self.logger.debug(f"Monitoring Update #{update_count} (Elapsed time: {elapsed_time:.1f}s)")
            self.logger.debug(f"{'='*50}")
            
            for iface in self.interfaces.values():
                try:
                    self.logger.debug(f"\nProcessing interface: {iface.name} ({iface.label})")
                    
                    # Verify interface still exists
                    if not os.path.exists(f"/sys/class/net/{iface.name}"):
                        self.logger.error(f"Interface {iface.name} no longer exists!")
                        continue
                    
                    # Get interface statistics
                    stats = self.get_interface_stats(iface.name)
                    self.logger.debug(f"Raw stats for {iface.name}:")
                    self.logger.debug(f"  RX bytes: {stats.get('rx_bytes', 'N/A'):,}")
                    self.logger.debug(f"  TX bytes: {stats.get('tx_bytes', 'N/A'):,}")
                    
                    if iface.name in prev_stats:
                        # Calculate rates
                        time_diff = stats['timestamp'] - prev_stats[iface.name]['timestamp']
                        rx_bytes_diff = stats['rx_bytes'] - prev_stats[iface.name]['rx_bytes']
                        tx_bytes_diff = stats['tx_bytes'] - prev_stats[iface.name]['tx_bytes']
                        
                        rx_rate = (rx_bytes_diff * 8) / time_diff / 1000000  # Mbps
                        tx_rate = (tx_bytes_diff * 8) / time_diff / 1000000  # Mbps
                        
                        self.logger.info(f"{iface.name} ({iface.label}) - RX: {rx_rate:.2f} Mbps, TX: {tx_rate:.2f} Mbps")
                        self.logger.debug(f"Detailed calculations for {iface.name}:")
                        self.logger.debug(f"  Time diff: {time_diff:.3f}s")
                        self.logger.debug(f"  RX bytes diff: {rx_bytes_diff:,} bytes")
                        self.logger.debug(f"  TX bytes diff: {tx_bytes_diff:,} bytes")
                        
                        # Get CAKE stats
                        try:
                            cake_stats = subprocess.run(
                                ['tc', '-s', 'qdisc', 'show', 'dev', iface.name],
                                capture_output=True, text=True, check=True
                            )
                            self.logger.debug(f"CAKE stats for {iface.name}:")
                            self.logger.debug(cake_stats.stdout.strip())
                        except subprocess.CalledProcessError as e:
                            self.logger.warning(f"Failed to get CAKE stats for {iface.name}: {e}")
                    
                    prev_stats[iface.name] = stats
                    
                except Exception as e:
                    self.logger.error(f"Error monitoring {iface.name}: {e}")
            
            time.sleep(1)  # Update interval

    def verify_configuration(self):
        """Print current CAKE and interface configuration"""
        self.logger.info("=== Current Configuration ===")
        
        # Verify interfaces exist
        for iface in self.interfaces.values():
            if not os.path.exists(f"/sys/class/net/{iface.name}"):
                self.logger.error(f"Interface {iface.name} does not exist!")
                continue
                
            self.logger.info(f"\nInterface: {iface.name} ({iface.label})")
            
            # Get CAKE configuration
            try:
                result = subprocess.run(['tc', '-s', 'qdisc', 'show', 'dev', iface.name],
                                     capture_output=True, text=True, check=True)
                self.logger.info(result.stdout)
            except subprocess.CalledProcessError as e:
                self.logger.error(f"Failed to get CAKE config for {iface.name}: {e}")

        # Check IFB configuration
        try:
            result = subprocess.run(['tc', '-s', 'qdisc', 'show', 'dev', 'ifb0'],
                                 capture_output=True, text=True, check=True)
            self.logger.info("\nIFB0 Configuration:")
            self.logger.info(result.stdout)
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Failed to get IFB configuration: {e}")

    def setup_cake(self):
        """Configure CAKE qdisc on all interfaces"""
        self.logger.info("Setting up CAKE on all interfaces")
        
        for iface in self.interfaces.values():
            try:
                self.logger.debug(f"\nConfiguring CAKE for {iface.name} ({iface.label})")
                
                # Clear existing qdiscs
                self.logger.debug(f"Clearing existing qdiscs on {iface.name}")
                subprocess.run(['tc', 'qdisc', 'del', 'dev', iface.name, 'root'], 
                             capture_output=True)  # Ignore errors if none exist
                
                cake_params = [
                    'tc', 'qdisc', 'add', 'dev', iface.name, 'root', 'cake',
                    'bandwidth', iface.bandwidth_egress,
                    'nat', 'memlimit', '32mb', 'diffserv4', 'rtt', '50ms',
                    'triple-isolate', 'ack-filter', 'split-gso'
                ]
                
                if iface.is_internal:
                    self.logger.debug(f"Using internal interface parameters for {iface.name}")
                    cake_params = [
                        'tc', 'qdisc', 'add', 'dev', iface.name, 'root', 'cake',
                        'bandwidth', iface.bandwidth_egress,
                        'memlimit', '64mb', 'besteffort', 'rtt', '50ms',
                        'ack-filter', 'split-gso'
                    ]
                
                self.logger.debug(f"Running CAKE setup command: {' '.join(cake_params)}")
                subprocess.run(cake_params, check=True)
                
                # Setup ingress qdisc for primary interface
                if iface.is_primary:
                    self.logger.debug(f"Setting up ingress qdisc for primary interface {iface.name}")
                    
                    # Clear existing ingress qdisc
                    subprocess.run([
                        'tc', 'qdisc', 'del', 'dev', iface.name, 'ingress'
                    ], capture_output=True)  # Ignore errors
                    
                    # Add ingress qdisc
                    subprocess.run([
                        'tc', 'qdisc', 'add', 'dev', iface.name, 
                        'handle', 'ffff:', 'ingress'
                    ], check=True)
                    
                    # Add redirect filter
                    subprocess.run([
                        'tc', 'filter', 'add', 'dev', iface.name, 
                        'parent', 'ffff:', 'protocol', 'ip', 'u32', 
                        'match', 'u32', '0', '0', 'action', 'mirred', 
                        'egress', 'redirect', 'dev', 'ifb0'
                    ], check=True)
                    
                    # Configure CAKE on ifb0 for ingress traffic
                    self.logger.debug(f"Configuring CAKE on ifb0 for {iface.name} ingress traffic")
                    subprocess.run([
                        'tc', 'qdisc', 'replace', 'dev', 'ifb0', 
                        'root', 'handle', '1:', 'cake',
                        'bandwidth', iface.bandwidth_ingress,
                        'memlimit', '32mb', 'diffserv4', 'rtt', '50ms',
                        'triple-isolate', 'ack-filter', 'nowash', 'split-gso'
                    ], check=True)
                
                self.logger.info(f"CAKE configuration completed for {iface.name}")
                
            except subprocess.CalledProcessError as e:
                self.logger.error(f"Failed to setup CAKE on {iface.name}: {e}")
                self.logger.debug(f"Command output: {e.output if hasattr(e, 'output') else 'No output'}")
                self.logger.debug(f"Command stderr: {e.stderr if hasattr(e, 'stderr') else 'No stderr'}")
                sys.exit(1)

def main():
    try:
        manager = NetworkManager()
        manager.setup_cake()
        manager.verify_configuration()
        manager.monitor_interfaces()
    except KeyboardInterrupt:
        print("\nShutting down gracefully...")
        sys.exit(0)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

