#!/usr/bin/env python3
import subprocess

# Launch Unbound in debug mode with very high verbosity.
cmd = ["/usr/sbin/unbound", "-d", "-vvvv"]
print("Launching Unbound with command:", " ".join(cmd))
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

try:
    while True:
        line = proc.stdout.readline()
        if not line:
            break  # End of output.
        # Check if the line contains "google" (case-insensitive).
        if "google" in line.lower():
            print(line.rstrip())
except KeyboardInterrupt:
    print("\nInterrupted by user. Terminating Unbound...")
    proc.terminate()

