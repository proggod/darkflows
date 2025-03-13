#!/usr/bin/env python3
import subprocess
import sys
import time
import os

def kill_unbound_processes() -> None:
    """
    Kill all running unbound processes, which will also terminate their parent screen sessions.
    """
    try:
        # First, use killall to directly kill unbound processes
        print("Using killall to terminate all unbound processes...")
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

if __name__ == "__main__":
    print("Testing kill_unbound_processes function...")
    kill_unbound_processes()
    print("Test completed.") 