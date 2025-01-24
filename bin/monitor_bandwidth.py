import logging
import logging.handlers
from pathlib import Path
import itertools
import sys
import time
import pexpect
import json
import re

# Configure rotating file handler for logs
LOG_PATH = Path('/var/log/bandwidth_monitor.log')
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(
    handlers=[
        logging.handlers.RotatingFileHandler(
            LOG_PATH,
            maxBytes=1_000_000,
            backupCount=3
        )
    ],
    format=LOG_FORMAT,
    level=logging.INFO
)

# Custom console spinner
class ProgressSpinner:
    def __init__(self):
        self.spinner = itertools.cycle(['|', '/', '-', '\\'])
        self.active = False

    def start(self):
        self.active = True
        sys.stdout.write("\033[?25l")  # Hide cursor
        
    def stop(self):
        self.active = False
        sys.stdout.write("\033[K")  # Clear line
        sys.stdout.write("\033[?25h")  # Show cursor

    def spin(self):
        if self.active:
            sys.stdout.write(next(self.spinner))
            sys.stdout.flush()
            sys.stdout.write('\b')

spinner = ProgressSpinner()

def strip_ansi(text: str) -> str:
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def log_initial_state():
    logging.info("="*40)
    logging.info("Starting Bandwidth Monitor")
    logging.info(f"Python version: {sys.version}")
    logging.info(f"Logging to: {LOG_PATH}")
    logging.info("="*40)

def parse_bandwidth(data: str) -> dict:
    hosts = {}
    lines = data.strip().split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if any(char * 3 in line for char in ['=', '-']) or \
           'Host name' in line or \
           'Total' in line or \
           'Peak' in line or \
           'Cumulative' in line:
            i += 1
            continue
            
        external_match = re.search(
            r'\*\s*=>\s*([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)',
            line
        )
        
        if external_match:
            i += 1
            if i >= len(lines): break
            
            internal_match = re.search(
                r'(192\.\d+\.\d+\.\d+)\s*<=\s*([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)\s+([\d.]+[KMGT]?[bB]?)',
                strip_ansi(lines[i])
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
            i += 1
        else:
            i += 1
            
    return hosts

def main():
    json_path = Path('/dev/shm/bandwidth.json')
    interface = 'enp2s0'
    last_valid_data = {'hosts': {}, 'status': 'initializing'}
    
    try:
        log_initial_state()
        logging.info("Initializing iftop process")
        print("\n[Bandwidth Monitor] Starting... (Ctrl+C to stop)")
        
        child = pexpect.spawn(
            f'iftop -nNt -i {interface}',
            timeout=5,
            encoding='utf-8',
            codec_errors='ignore'
        )
        child.send('s')
        time.sleep(2)
        
        spinner.start()
        logging.info("Entering main monitoring loop")
        cycle_count = 0

        while True:
            try:
                # Capture output
                child.sendcontrol('l')
                output = ""
                for _ in range(3):
                    try:
                        child.expect(r'.+', timeout=0.2)
                        output += child.before + child.after
                    except (pexpect.TIMEOUT, pexpect.EOF):
                        break

                # Process data
                cleaned = strip_ansi(output)
                current_hosts = parse_bandwidth(cleaned)
                cycle_count += 1

                # Update spinner
                spinner.spin()

                # Log every 10 cycles (≈10 seconds)
                if cycle_count % 10 == 0:
                    logging.info(f"Processed {cycle_count} cycles")
                    logging.debug(f"Current hosts: {list(current_hosts.keys())}")

                # Prepare new data
                new_data = {
                    'timestamp': time.time(),
                    'hosts': current_hosts or last_valid_data['hosts'],
                    'status': 'active' if current_hosts else 'no_traffic'
                }

                # Only update if we have new hosts data
                if current_hosts:
                    last_valid_data = new_data
                else:
                    last_valid_data['timestamp'] = new_data['timestamp']
                    last_valid_data['status'] = new_data['status']

                # Atomic write using rename
                temp_path = json_path.with_suffix('.tmp')
                with temp_path.open('w') as f:
                    json.dump(last_valid_data, f, indent=2)
                temp_path.rename(json_path)

                time.sleep(1)

            except KeyboardInterrupt:
                raise
            except Exception as e:
                logging.error(f"Processing error: {str(e)}", exc_info=True)
                spinner.stop()
                print(f"\n[!] Error encountered - see {LOG_PATH}")
                spinner.start()

    except KeyboardInterrupt:
        spinner.stop()
        print("\n[!] Shutting down gracefully...")
        logging.info("Received keyboard interrupt, shutting down")
        last_valid_data.update({
            'timestamp': time.time(),
            'status': 'shutdown'
        })
        with json_path.open('w') as f:
            json.dump(last_valid_data, f)
        child.close()
        
    except Exception as e:
        spinner.stop()
        print(f"\n[!] Critical error: {str(e)}")
        logging.critical("Unhandled exception", exc_info=True)
        sys.exit(1)
        
    finally:
        spinner.stop()
        logging.info("Shutdown complete\n")

if __name__ == "__main__":
    main()


