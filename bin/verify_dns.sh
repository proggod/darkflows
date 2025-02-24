#!/bin/bash
# This script tests if DNS resolution is working.
# If not, it adds "nameserver 127.0.0.1" (to use your local DNS)
# and then "nameserver 8.8.8.8" as a fallback to /etc/resolv.conf.

RESOLV_CONF="/etc/resolv.conf"
TEST_DOMAIN="google.com"

# Function to test DNS by resolving TEST_DOMAIN using dig.
dns_working() {
    # Using dig +short to obtain IPv4 addresses.
    if dig +short "$TEST_DOMAIN" | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' > /dev/null; then
        return 0
    else
        return 1
    fi
}

echo "Testing DNS resolution for $TEST_DOMAIN..."
if dns_working; then
    echo "DNS is working. No changes needed."
    exit 0
fi

echo "DNS is not working. Checking /etc/resolv.conf..."

# Backup the current resolv.conf
cp "$RESOLV_CONF" "${RESOLV_CONF}.bak.$(date +%s)"

# Check if 127.0.0.1 is present; if not, prepend it.
if ! grep -qE '^\s*nameserver\s+127\.0\.0\.1' "$RESOLV_CONF"; then
    echo "Adding 'nameserver 127.0.0.1' to $RESOLV_CONF..."
    # Prepend the entry
    { echo "nameserver 127.0.0.1"; cat "$RESOLV_CONF"; } > /tmp/resolv.conf && mv /tmp/resolv.conf "$RESOLV_CONF"
fi

echo "Testing DNS after adding 127.0.0.1..."
if dns_working; then
    echo "DNS is now working using 127.0.0.1."
    exit 0
fi

# If still not working, check if 8.8.8.8 is present; if not, append it.
if ! grep -qE '^\s*nameserver\s+8\.8\.8\.8' "$RESOLV_CONF"; then
    echo "Adding 'nameserver 8.8.8.8' to $RESOLV_CONF..."
    echo "nameserver 8.8.8.8" >> "$RESOLV_CONF"
fi

echo "Testing DNS after adding 8.8.8.8..."
if dns_working; then
    echo "DNS is now working after adding 8.8.8.8."
    exit 0
else
    echo "DNS is still not working after modifications."
    exit 1
fi
