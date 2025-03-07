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
    if dpkg -l | grep -q "^ii\s\+$package\s"; then
        print_status "OK" "$description (Package: $package)"
        return 0
    else
        print_status "FAIL" "$description (Package: $package)"
        return 1
    fi
}

# Function to run installer
run_installer() {
    local script=$1
    local description=$2
    echo -e "\e[33m[!] Attempting to fix $description by running $script...\e[0m"
    if [ -f "/usr/local/darkflows/installer/$script" ]; then
        bash "/usr/local/darkflows/installer/$script"
        return $?
    else
        echo -e "\e[31m[✗] Installer script $script not found!\e[0m"
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
        run_installer "change_passwords.sh" "user configuration"
    fi
else
    print_status "FAIL" "DarkFlows user does not exist"
    ((errors++))
    run_installer "change_passwords.sh" "user configuration"
fi
echo

# 2. Check IP forwarding (change_variables.sh)
echo "=== Checking System Configuration ==="
if sysctl net.ipv4.ip_forward | grep -q "= 1"; then
    print_status "OK" "IP forwarding is enabled"
else
    print_status "FAIL" "IP forwarding is not enabled"
    ((errors++))
    run_installer "change_variables.sh" "system configuration"
fi
echo

# 3. Check required packages (install_packages.sh)
package_errors=0
echo "=== Checking Required Packages ==="
packages=("python3-pexpect" "openssh-server" "mariadb-server" "nodejs" "npm" "nftables" 
         "kea" "curl" "screen" "vlan" "irqbalance" "ethtool" 
         "samba" "iperf3" "ca-certificates" "iftop")

for pkg in "${packages[@]}"; do
    check_package "$pkg" "Required package" || ((package_errors++))
done
if [ $package_errors -gt 0 ]; then
    run_installer "install_packages.sh" "package installation"
fi
echo

# 3.5. Check Nginx Installation
echo "=== Checking Nginx Installation ==="
if check_package "nginx" "Nginx web server"; then
    print_status "OK" "Nginx is installed"
else
    print_status "FAIL" "Nginx is not installed"
    run_installer "install_nginx.sh" "nginx installation"
fi
echo

# 4. Check MySQL/MariaDB (secure_mysql.sh)
echo "=== Checking Database Configuration ==="
if mysqladmin ping >/dev/null 2>&1; then
    print_status "OK" "MariaDB is running"
else
    print_status "FAIL" "MariaDB is not running"
    ((errors++))
    run_installer "secure_mysql.sh" "database configuration"
fi
echo

# 5. Check Web Setup (setup_web.sh)
echo "=== Checking Web Configuration ==="
if [ -d "/usr/local/darkflows/src/live-ifstat/.next" ]; then
    print_status "OK" "Next.js application is built"
else
    print_status "FAIL" "Next.js application build is missing"
    ((errors++))
    run_installer "setup_web.sh" "web configuration"
fi
echo

# 6. Check Network Configuration (detect_network.sh)
echo "=== Checking Network Configuration ==="
network_error=0
if [ -f "/etc/darkflows/d_network.cfg" ]; then
    print_status "OK" "Network configuration file exists"
    source /etc/darkflows/d_network.cfg
    if [ -n "$PRIMARY_INTERFACE" ] && [ -e "/sys/class/net/$PRIMARY_INTERFACE" ]; then
        print_status "OK" "Primary interface ($PRIMARY_INTERFACE) exists"
    else
        print_status "FAIL" "Primary interface configuration issue"
        ((network_error++))
    fi
else
    print_status "FAIL" "Network configuration file is missing"
    ((network_error++))
fi
if [ $network_error -gt 0 ]; then
    run_installer "detect_network.sh" "network configuration"
fi
echo

# 7. Check KEA DHCP (create_kea_user.sh)
echo "=== Checking KEA DHCP Configuration ==="
kea_error=0
check_service "kea-dhcp4-server" "KEA DHCP4 service" || ((kea_error++))
if mysql -e "use kea;" >/dev/null 2>&1; then
    print_status "OK" "KEA database exists"
else
    print_status "FAIL" "KEA database is missing"
    ((kea_error++))
fi
if [ $kea_error -gt 0 ]; then
    run_installer "create_kea_user.sh" "KEA DHCP configuration"
fi
echo

# 8. Check Services (setup_services.sh)
echo "=== Checking Required Services ==="
service_errors=0
services=("nextjs-app" "irqbalance" "kea-dhcp4-server" 
         "mariadb" "nmbd" "ssh" "smbd")

for svc in "${services[@]}"; do
    check_service "$svc" "Required service" || ((service_errors++))
done
if [ $service_errors -gt 0 ]; then
    run_installer "setup_services.sh" "services configuration"
fi
echo

# 9. Check Docker (install_docker.sh)
echo "=== Checking Docker Installation ==="
docker_error=0
check_service "docker" "Docker service" || ((docker_error++))
if [ $docker_error -gt 0 ]; then
    run_installer "install_docker.sh" "Docker installation"
fi
echo


# 11. Check SSH Configuration (update_ssh_key_location.sh)
echo "=== Checking SSH Configuration ==="
if grep -q "AuthorizedKeysFile.*%h/.ssh/authorized_keys.*/etc/ssh/%u/authorized_keys" /etc/ssh/sshd_config; then
    print_status "OK" "SSH authorized keys configuration is correct"
else
    print_status "FAIL" "SSH authorized keys configuration is incorrect"
    ((errors++))
    run_installer "update_ssh_key_location.sh" "SSH configuration"
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


