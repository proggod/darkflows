import logging
import logging.handlers
from pathlib import Path
import itertools
import sys
import time
import pexpect
import json
import re

def get_internal_interface():
    config_path = Path('/etc/darkflows/d_network.cfg')
    try:
        with config_path.open('r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('INTERNAL_INTERFACE='):
                    value = line.split('=', 1)[1].strip(' \'"')
                    return value
            raise ValueError("INTERNAL_INTERFACE not found in config file")
    except FileNotFoundError:
        raise ValueError(f"Config file not found at {config_path}")

# Configuration
LOG_PATH = Path('/var/log/bandwidth_monitor.log')
JSON_PATH = Path('/dev/shm/bandwidth.json')
try:
    INTERFACE = get_internal_interface()
except ValueError as e:
    print(f"Fatal error: {e}")
    sys.exit(1)
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
SCREEN_CAPTURE_TIMEOUT = 5

logging.basicConfig(
    handlers=[logging.handlers.RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3)],
    format=LOG_FORMAT,
    level=logging.INFO
)

class ProgressSpinner:
    def __init__(self):
        self.spinner = itertools.cycle(['|', '/', '-', '\\'])
        self.active = False

    def start(self):
        self.active = True
        sys.stdout.write("\033[?25l")
        sys.stdout.write("[Bandwidth Monitor] Starting... ")
        
    def stop(self):
        self.active = False
        sys.stdout.write("\033[K")
        sys.stdout.write("\033[?25h")

    def spin(self):
        if self.active:
            sys.stdout.write(next(self.spinner))
            sys.stdout.flush()
            sys.stdout.write('\b')

spinner = ProgressSpinner()  # Initialize spinner here

def strip_ansi(text: str) -> str:
    return re.sub(r'\x1B\[[0-?]*[ -/]*[@-~]', '', text)

def capture_full_screen(child):
    """Capture the complete iftop screen output."""
    child.sendcontrol('l')
    time.sleep(0.5)  # Wait for screen clear
    
    output = ""
    start_time = time.time()
    
    while time.time() - start_time < SCREEN_CAPTURE_TIMEOUT:
        try:
            child.expect(['Cumulative \(sent/received/total\):', pexpect.TIMEOUT], timeout=0.5)
            current = child.before + child.after
            output += current
            
            if 'Cumulative (sent/received/total):' in output:
                # Get the final line after cumulative stats
                child.expect('\n', timeout=0.5)
                output += child.before + child.after
                return output
                
        except pexpect.EOF:
            break
            
    return output

def parse_bandwidth(data: str) -> dict:
    hosts = {}
    sections = data.split('====')
    
    # Find the section with the most complete data
    max_hosts_section = None
    max_hosts_count = 0
    
    for section in sections:
        if not section.strip():
            continue
            
        lines = section.strip().split('\n')
        host_count = sum(1 for line in lines if '=>' in line)
        
        if host_count > max_hosts_count:
            max_hosts_count = host_count
            max_hosts_section = section
    
    if not max_hosts_section:
        return hosts
        
    lines = max_hosts_section.strip().split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if not line or 'Host name' in line or 'Total' in line or \
           'Peak' in line or any(char * 3 in line for char in ['=', '-']):
            i += 1
            continue
            
        external_match = re.search(
            r'\*?\s*=>\s*([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)',
            line
        )
        
        if external_match and i + 1 < len(lines):
            internal_line = strip_ansi(lines[i + 1])
            internal_match = re.search(
                r'(192\.\d+\.\d+\.\d+)\s*<=\s*([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)',
                internal_line
            )
            
            if internal_match:
                hosts[internal_match.group(1)] = {
                    'last_2s_sent': external_match.group(1),
                    'last_10s_sent': external_match.group(2),
                    'last_40s_sent': external_match.group(3),
                    'cumulative_sent': external_match.group(4),
                    'last_2s_received': internal_match.group(2),
                    'last_10s_received': internal_match.group(3),
                    'last_40s_received': internal_match.group(4),
                    'cumulative_received': internal_match.group(5),
                    'last_updated': time.time()
                }
                i += 2
            else:
                i += 1
        else:
            i += 1
            
    return hosts

def main():
    last_valid_data = {'hosts': {}, 'status': 'initializing'}
    
    try:
        print("\n[Bandwidth Monitor] Initializing...")
        child = pexpect.spawn(
            f'iftop -nNt -L 100 -o 40s -i {INTERFACE}',
            timeout=10,
            encoding='utf-8',
            codec_errors='ignore'
        )

        child.send('s')  # Enable cumulative stats
        time.sleep(2)  # Initial stabilization
        
        spinner.start()
        print("\n[Bandwidth Monitor] Running (Ctrl+C to stop)")
        
        while True:
            try:
                output = capture_full_screen(child)
                cleaned = strip_ansi(output)
                current_hosts = parse_bandwidth(cleaned)
                
                new_data = {
                    'timestamp': time.time(),
                    'hosts': current_hosts or last_valid_data['hosts'],
                    'status': 'active' if current_hosts else 'no_traffic'
                }
                
                if current_hosts:
                    last_valid_data = new_data
                else:
                    last_valid_data.update({
                        'timestamp': new_data['timestamp'],
                        'status': new_data['status']
                    })

                temp_path = JSON_PATH.with_suffix('.tmp')
                with temp_path.open('w') as f:
                    json.dump(last_valid_data, f, indent=2)
                temp_path.rename(JSON_PATH)

                sys.stdout.write("\r" + " " * 80)  # Clear line
                if current_hosts:
                    sys.stdout.write(f"\r[Update] Processed {len(current_hosts)} hosts")
                else:
                    sys.stdout.write("\r[Update] No active hosts detected")
                sys.stdout.flush()

                time.sleep(2)

            except KeyboardInterrupt:
                break
            except Exception as e:
                logging.error(f"Processing error: {str(e)}", exc_info=True)
                spinner.stop()
                print(f"\n[!] Error encountered - see {LOG_PATH}")
                spinner.start()

    except Exception as e:
        logging.critical(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)
        
    finally:
        spinner.stop()
        child.close()
        print("\n[Bandwidth Monitor] Shutdown complete")
        logging.info("Shutdown complete")

if __name__ == "__main__":
    main()
