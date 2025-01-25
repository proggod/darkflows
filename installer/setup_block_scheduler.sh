#!/bin/bash

# Define the cron job command
CRON_CMD="*/5 * * * * /usr/bin/python3 /usr/local/darkflows/bin/block_scheduler.py"

# Check if the cron job already exists
if crontab -l 2>/dev/null | grep -q "block_scheduler.py"; then
    echo "Block scheduler is already in crontab"
else
    # Create a temporary file with existing crontab
    crontab -l 2>/dev/null > /tmp/current_crontab

    # Add our new command
    echo "# Block scheduler - added $(date)" >> /tmp/current_crontab
    echo "$CRON_CMD" >> /tmp/current_crontab

    # Install the new crontab
    if crontab /tmp/current_crontab; then
        echo "Successfully added block scheduler to crontab"
    else
        echo "Failed to add block scheduler to crontab"
        exit 1
    fi

    # Clean up
    rm /tmp/current_crontab
fi

# Verify the crontab entry
echo -e "\nCurrent crontab entries:"
crontab -l

# Verify the script exists and is executable
if [ ! -f "/usr/local/darkflows/bin/block_scheduler.py" ]; then
    echo "Warning: block_scheduler.py not found!"
    exit 1
fi

if [ ! -x "/usr/local/darkflows/bin/block_scheduler.py" ]; then
    echo "Making block_scheduler.py executable..."
    chmod +x /usr/local/darkflows/bin/block_scheduler.py
fi

echo -e "\nVerifying required scripts exist and are executable:"
for script in block_clients.sh clear_blocks.sh list_blocks.sh; do
    if [ ! -f "/usr/local/darkflows/bin/$script" ]; then
        echo "Warning: $script not found!"
    elif [ ! -x "/usr/local/darkflows/bin/$script" ]; then
        echo "Making $script executable..."
        chmod +x "/usr/local/darkflows/bin/$script"
    else
        echo "$script is present and executable"
    fi
done

echo -e "\nSetup complete!"

