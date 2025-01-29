#!/bin/sh

# Rotate journal files and vacuum (remove archived files)
sudo journalctl --rotate
sudo journalctl --vacuum-time=1s

# Alternative: Delete all journal logs immediately
sudo rm -rf /var/log/journal/*
sudo systemctl restart systemd-journald
# Clear syslog (keeps the file but empties it)
sudo truncate -s 0 /var/log/syslog

# Clear auth log
sudo truncate -s 0 /var/log/auth.log

# Clear all log files (⚠️ **BE CAREFUL**)
sudo truncate -s 0 /var/log/*.log

