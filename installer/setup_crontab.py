#!/usr/bin/env python3

import os
import subprocess
import sys
import re
from datetime import datetime

# Define the cron jobs to ensure are installed (one per line)
# Format: (cron_schedule, command, description)
REQUIRED_CRON_JOBS = [
    ("*/5 * * * *", "/usr/bin/python3 /usr/local/darkflows/bin/block_scheduler.py", "Block scheduler"),
    ("*/5 * * * *", "/usr/local/darkflows/bin/update_dyndns.sh", "DynDNS updater"),
    # Add more entries here as needed, following the same format
]

def get_current_crontab():
    """Get the current crontab content."""
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
        return ""
    except Exception as e:
        print(f"Error reading crontab: {e}")
        return ""

def write_crontab(content):
    """Write content to crontab."""
    temp_file = "/tmp/new_crontab"
    try:
        with open(temp_file, 'w') as f:
            f.write(content)
        
        result = subprocess.run(['crontab', temp_file], capture_output=True, text=True)
        if result.returncode == 0:
            print("Successfully updated crontab")
            return True
        else:
            print(f"Failed to update crontab: {result.stderr}")
            return False
    except Exception as e:
        print(f"Error writing crontab: {e}")
        return False
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

def ensure_cron_jobs():
    """Ensure all required cron jobs are properly installed."""
    current_crontab = get_current_crontab()
    lines = current_crontab.split('\n') if current_crontab else []
    changes_needed = False
    
    # Check each required job
    for schedule, command, description in REQUIRED_CRON_JOBS:
        # Create a pattern to match the command portion, ignoring whitespace differences
        command_pattern = re.escape(command).replace('\\ ', '\\s+')
        pattern = re.compile(command_pattern)
        
        # Count how many times this command appears
        matches = [line for line in lines if pattern.search(line)]
        count = len(matches)
        
        if count == 0:
            print(f"{description} not found in crontab, adding it now...")
            lines.append(f"# {description} - added {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"{schedule} {command}")
            changes_needed = True
        elif count > 1:
            print(f"WARNING: Multiple entries ({count}) found for {description} in crontab!")
            print("Current entries:")
            for match in matches:
                print(f"  {match}")
            
            # Remove all occurrences
            lines = [line for line in lines if not pattern.search(line)]
            
            # Add back just one entry
            lines.append(f"# {description} - fixed {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"{schedule} {command}")
            
            print(f"Removed duplicates and kept only one instance of {description}")
            changes_needed = True
        else:
            print(f"{description} has exactly one entry in crontab (correct)")
    
    # Update crontab if changes were made
    if changes_needed:
        new_crontab = '\n'.join(lines)
        if write_crontab(new_crontab):
            print("Crontab updated successfully")
        else:
            print("Failed to update crontab")
            return False
    else:
        print("No changes needed to crontab")
    
    return True

def main():
    """Main function."""
    print("Checking and ensuring required cron jobs...")
    if not ensure_cron_jobs():
        sys.exit(1)
    
    print("\nCurrent crontab entries:")
    os.system("crontab -l")
    
    print("\nSetup complete!")

if __name__ == "__main__":
    main()

