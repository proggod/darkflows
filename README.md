# Welcome to DarkFlows Firewall/Router OS

## Features
- Uses kea for DHCP
- Uses Pihole for DNS
- Full Web UI
- Many scripts to do everything from port forwarding to client management
- configs exist in /etc/darkflows
- everything else is in /usr/local/darkflows
- Uses PiHole for DNS
- Visit web after at "http://192.168.58.1"

## Installation
```
su - root ; apt install curl ; curl -sSL https://darkflows.com/downloads/install.sh | bash
```

### Fast Reboot Command
```
/usr/local/darkflows/bin/reboot_server.sh
``` 

## Changelog
v 0.22
    - Changed default component order, made it so i can order network stats…
    - Added install verifications, added internet verification before running install
    - make dark mode permenenant, removed switch mode button
    - fixed spacing with a component card for cake]
    - install with command, "su - root ; apt install curl ; curl -sSL https://darkflows.com/downloads/install.sh | bash"
    - visit web after at "http://192.168.58.1"

v 0.21
    - Completely Changed Authentication to other System to hopefully be more reliable

v 0.20
    - Fixed issue creating account
    - Excluded default login file

v 0.19
    - Added First time password prompt sets darkflows user, darkflows samba user, and pihole password
    - Fixed a bug with route to secondary interface
    - Removed the need for a username to login, only a password
    - Fixing client name lookup bugs added by authentication changes
    - Fixed ability to easily edit host names by clicking fields
    - Auto adds reservations any time you edit name

v 0.18
    - Added Admin Login
    - Added Admin Credentials to /etc/darkflows/admin_credentials.json
    - Added Security to All API Routes

v 0.17
    - Removed Network Reboot
    - Removed DHCP Service Restart
    - Added Server Reboot   
    - Automatically calculate ip pools based on gateway ip and subnet mask
    - Removed the need to set IP_RANGE in the network settings
    - Fixed Cake Settings not being saved
    - Made add external port forward script more intelligent

v 0.16
    - Added Navigation Bar
    - Fixed losing layout on reload

v 0.15
    - Fixed build errors on website


v 0.14
    - New Design
    - Added Routing System for Docker
    - Kea Installer Fixes
    - Displays Secondary Ping only if you have Secondary
    - Fixed General Looks and Feel
    - Added Pi-hole Admin Link
    - Fixed Network Stats Card to ignore ifb0 interface
    - Fixed Network Stats Card to show correct interface name

