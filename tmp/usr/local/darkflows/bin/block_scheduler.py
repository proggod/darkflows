#!/usr/bin/env python3
import json
from datetime import datetime, time
import subprocess
import logging
import os

# Configuration
JSON_PATH = '/etc/darkflows/block_schedule.json'
STATE_PATH = '/etc/darkflows/block_state.json'
LOG_PATH = '/var/log/block_scheduler.log'

# Set up logging
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def check_for_blocks():
    """Check if there are any active blocks in nftables"""
    try:
        result = subprocess.run(['/usr/local/darkflows/bin/list_blocks.sh'], 
                              capture_output=True, text=True, check=True)
        
        lines = result.stdout.split('\n')
        in_macs = False
        in_ips = False
        has_blocks = False
        
        for line in lines:
            line = line.strip()
            if line == "BEGIN_MACS":
                in_macs = True
                continue
            elif line == "END_MACS":
                in_macs = False
                continue
            elif line == "BEGIN_IPS":
                in_ips = True
                continue
            elif line == "END_IPS":
                in_ips = False
                continue
            
            if (in_macs or in_ips) and line and \
               line not in ["BEGIN_ACTIVE_BLOCKS", "END_ACTIVE_BLOCKS"]:
                has_blocks = True
                break
        
        logging.debug(f"Block check result: {has_blocks}")
        return has_blocks
    except Exception as e:
        logging.error(f"Failed to check blocks: {e}")
        return False

def write_state(new_state):
    """Update state file"""
    try:
        with open(STATE_PATH, 'w') as f:
            json.dump({'state': new_state}, f)
        logging.info(f"State updated to: {new_state}")
    except Exception as e:
        logging.error(f"Failed to write state: {e}")

def load_schedule():
    """Load JSON schedule"""
    try:
        with open(JSON_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Failed to load schedule: {e}")
        raise

def get_current_day_time():
    """Return current day (lowercase) and time object"""
    now = datetime.now()
    return now.strftime("%a").lower(), now.time()

def is_active_time(entry):
    """Check if current time is within schedule window"""
    try:
        start = time.fromisoformat(entry['startTime'])
        end = time.fromisoformat(entry['endTime'])
        current_time = datetime.now().time()

        if start <= end:
            return start <= current_time <= end
        # Handle overnight ranges
        return current_time >= start or current_time <= end
    except Exception as e:
        logging.error(f"Failed to check active time: {e}")
        return False

def execute_command(action):
    """Execute block/unblock script"""
    commands = {
        'block': ['/usr/local/darkflows/bin/block_clients.sh'],
        'unblock': ['/usr/local/darkflows/bin/clear_blocks.sh']
    }
    if action not in commands:
        logging.error(f"Invalid action: {action}")
        return False

    try:
        # Execute the action
        logging.info(f"Running {action} script...")
        result = subprocess.run(commands[action], check=True, capture_output=True, text=True)
        
        # Log the output
        if result.stdout:
            logging.info(f"Script output: {result.stdout}")
        if result.stderr:
            logging.warning(f"Script stderr: {result.stderr}")
        
        # Verify the result
        blocks_exist = check_for_blocks()
        if action == 'block' and not blocks_exist:
            logging.error("Block command executed but no blocks found")
            return False
        if action == 'unblock' and blocks_exist:
            logging.error("Unblock command executed but blocks still exist")
            return False
            
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"Command failed: {e}")
        if e.output:
            logging.error(f"Command output: {e.output}")
        if e.stderr:
            logging.error(f"Command stderr: {e.stderr}")
        return False
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        return False

def main():
    try:
        # Load schedule and check current status
        schedule = load_schedule()
        current_day, _ = get_current_day_time()
        
        # Check if any blocks currently exist
        actual_blocks_exist = check_for_blocks()
        logging.info(f"Current day: {current_day}")
        logging.info(f"Blocks currently exist: {actual_blocks_exist}")

        # Find today's schedule entry
        entry = next((item for item in schedule if item['id'] == current_day), None)
        if not entry:
            logging.info(f"No schedule found for {current_day} - treating as no-block time")
            if actual_blocks_exist:
                logging.info("Removing blocks as no schedule exists for today")
                if execute_command('unblock'):
                    write_state('unblocked')
            return

        # Should we be blocking right now?
        should_block = is_active_time(entry)
        logging.info(f"Should be blocking based on schedule: {should_block}")

        if should_block:
            # We should be blocking
            if not actual_blocks_exist:
                logging.info("BLOCK TIME: No blocks found - adding blocks")
                if execute_command('block'):
                    write_state('blocked')
            else:
                logging.info("BLOCK TIME: Blocks already in place - no action needed")
        else:
            # We should not be blocking
            if actual_blocks_exist:
                logging.info("NO-BLOCK TIME: Found blocks - removing them")
                if execute_command('unblock'):
                    write_state('unblocked')
            else:
                logging.info("NO-BLOCK TIME: No blocks found - no action needed")

    except Exception as e:
        logging.error(f"Critical error: {str(e)}")

if __name__ == "__main__":
    main()


