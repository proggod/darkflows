#!/bin/bash

# Function for colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "OK" ]; then
        echo -e "\e[32m[✓] $message\e[0m"
    else
        echo -e "\e[31m[✗] $message\e[0m"
    fi
}

# Function to check if a service is active and enabled
check_service() {
    local service=$1
    local description=$2
    if systemctl is-active "$service" >/dev/null 2>&1 && systemctl is-enabled "$service" >/dev/null 2>&1; then
        print_status "OK" "$description (Service: $service)"
        return 0
    else
        print_status "FAIL" "$description (Service: $service)"
        return 1
    fi
}

# Function to check if a package is installed
check_package() {
    local package=$1
    local description=$2
    if dpkg -l | grep -q "^ii.*$package "; then
        print_status "OK" "$description (Package: $package)"
        return 0
    else
        print_status "FAIL" "$description (Package: $package)"
        return 1
    fi
}

# Initialize error counter
errors=0

echo "=== DarkFlows Installation Verification ==="
echo "Starting verification process..."
echo

# 1. Check user creation (change_passwords.sh)
echo "=== Checking User Configuration ==="
if id "darkflows" >/dev/null 2>&1; then
    print_status "OK" "DarkFlows user exists"
    if groups darkflows | grep -q sudo; then
        print_status "OK" "DarkFlows user has sudo privileges"
    else
        print_status "FAIL" "DarkFlows user missing sudo privileges"
        ((errors++))
    fi
else
    print_status "FAIL" "DarkFlows user does not exist"
    ((errors++))
fi
echo

# 2. Check IP forwarding (change_variables.sh)
echo "=== Checking System Configuration ==="
if sysctl net.ipv4.ip_forward | grep -q "= 1"; then
    print_status "OK" "IP forwarding is enabled"
else
    print_status "FAIL" "IP forwarding is not enabled"
    ((errors++))
fi
echo

# 3. Check required packages (install_packages.sh)
echo "=== Checking Required Packages ==="
packages=("python3-pexpect" "openssh-server" "mariadb-server" "nodejs" "npm" "nftables" 
         "kea" "curl" "screen" "vlan" "irqbalance" "firefox-esr" "ethtool" 
         "samba" "iperf3" "ca-certificates" "iftop")

for pkg in "${packages[@]}"; do
    check_package "$pkg" "Required package" || ((errors++))
done
echo

# 4. Check MySQL/MariaDB (secure_mysql.sh)
echo "=== Checking Database Configuration ==="
if mysqladmin ping >/dev/null 2>&1; then
    print_status "OK" "MariaDB is running"
else
    print_status "FAIL" "MariaDB is not running"
    ((errors++))
fi
echo

# 5. Check Pi-hole (install_pihole.sh)
echo "=== Checking Pi-hole Installation ==="
if [ -f "/usr/local/bin/pihole" ]; then
    print_status "OK" "Pi-hole is installed"
    check_service "pihole-FTL" "Pi-hole FTL service" || ((errors++))
else
    print_status "FAIL" "Pi-hole is not installed"
    ((errors++))
fi
echo

# 6. Check Web Setup (setup_web.sh)
echo "=== Checking Web Configuration ==="
if [ -d "/usr/local/darkflows/src/live-ifstat/.next" ]; then
    print_status "OK" "Next.js application is built"
else
    print_status "FAIL" "Next.js application build is missing"
    ((errors++))
fi
echo

# 7. Check Network Configuration (detect_network.sh)
echo "=== Checking Network Configuration ==="
if [ -f "/etc/darkflows/d_network.cfg" ]; then
    print_status "OK" "Network configuration file exists"
    # Source the config file to check interfaces
    source /etc/darkflows/d_network.cfg
    if [ -n "$PRIMARY_INTERFACE" ] && [ -e "/sys/class/net/$PRIMARY_INTERFACE" ]; then
        print_status "OK" "Primary interface ($PRIMARY_INTERFACE) exists"
    else
        print_status "FAIL" "Primary interface configuration issue"
        ((errors++))
    fi
else
    print_status "FAIL" "Network configuration file is missing"
    ((errors++))
fi
echo

# 8. Check KEA DHCP (create_kea_user.sh)
echo "=== Checking KEA DHCP Configuration ==="
check_service "kea-dhcp4-server" "KEA DHCP4 service" || ((errors++))
if mysql -e "use kea;" >/dev/null 2>&1; then
    print_status "OK" "KEA database exists"
else
    print_status "FAIL" "KEA database is missing"
    ((errors++))
fi
echo

# 9. Check Services (setup_services.sh)
echo "=== Checking Required Services ==="
services=("nextjs-app" "irqbalance" "kea-dhcp4-server" 
         "lighttpd" "mariadb" "nmbd" "pihole-FTL" "ssh" "smbd")

for svc in "${services[@]}"; do
    check_service "$svc" "Required service" || ((errors++))
done
echo

# 10. Check Docker (install_docker.sh)
echo "=== Checking Docker Installation ==="
#check_package "docker-ce" "Docker CE" || ((errors++))
check_service "docker" "Docker service" || ((errors++))
echo

# 11. Check Block Scheduler (setup_block_scheduler.sh)
echo "=== Checking Block Scheduler ==="
if [ -f "/usr/local/darkflows/bin/block_scheduler.py" ]; then
    print_status "OK" "Block scheduler script exists"
    if crontab -l 2>/dev/null | grep -q "block_scheduler.py"; then
        print_status "OK" "Block scheduler cron job is configured"
    else
        print_status "FAIL" "Block scheduler cron job is missing"
        ((errors++))
    fi
else
    print_status "FAIL" "Block scheduler script is missing"
    ((errors++))
fi
echo

# 12. Check SSH Configuration (update_ssh_key_location.sh)
echo "=== Checking SSH Configuration ==="
if grep -q "AuthorizedKeysFile.*%h/.ssh/authorized_keys.*/etc/ssh/%u/authorized_keys" /etc/ssh/sshd_config; then
    print_status "OK" "SSH authorized keys configuration is correct"
else
    print_status "FAIL" "SSH authorized keys configuration is incorrect"
    ((errors++))
fi
echo

# Final summary
echo "=== Verification Summary ==="
if [ $errors -eq 0 ]; then
    echo -e "\e[32mAll checks passed successfully!\e[0m"
    exit 0
else
    echo -e "\e[31mVerification completed with $errors error(s)\e[0m"
    echo "Please check the installation logs for more details"
    exit 1
fi 
