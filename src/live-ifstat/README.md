# Welcome to DarkFlows Firewall/Router OS

## Features
- Uses kea for DHCP
- Uses unbound for DNS w/ custom web frontend and wrapper
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

## Fast Reboot Command
```
/usr/local/darkflows/bin/reboot_server.sh
``` 

## Reset Cards
- Modify /api/version/route.ts to change the version number
    

## Changelog
### v0.36
- Fixed weather component so it stores choice and works for non-US
- Fixed delete ssh key
- Added CloudFlare dynamic dns settings to web admin
- Added wifi network setup script in bin/wifi/ - Full wifi support
- Added wifi settings component on web admin
- Changed response breakpoints to add more columns on slightly smaller screens

### v0.35
- Set docker to host networking only
- Made ISO install more interactive
- Using default directories for unbound, kea and darkflow
- Create app to verify crontab entries
- Add crontab entry to update dynamic dns on CloudFlare
- Modified update cloudflare dyndns to run only once so it can be in crontab
- Removed session secret from backup so its generated first time its run
- Added log viewer to services
- Changes some logic in the cookies for the server
- Fixed component overflow for services


### v0.34
- removed pihole button
- fixed delete reservation route
- fixed add reservation
- fixed dns clients referencing leases updated for new db driven kea + unbound
- Fixed sort on reservationscard

### v0.33
- Switched to Unbound for DNS
- Added Custom DNS Lists
- Added DNS Client Blocklist
- Added DNS Client Whitelist
- Added DNS Hosts
- Added DNS Resolver Status
- Added UPNP Installer
- Added VLAN Web Interface
- Created Unbound DNS Mysql System
- Created UnBound blacklist management system
- Fixed System Monitor to not use SSE
- Made ISO pull dynamic installer
- Major security and authentication updates
- So much major stuff to add for VLANS
- DHCP Vlan Support
- DHCP Vlan Custom DNS support
- DNS Vlan Support
- Traffic shaping VLAN support
- Traffic routing VLAN support
- Local port mapping vlan support
- Added NGINX removed LightHttpd reliance
- Generate SSL cert, proxy through NGINX for SSL    
- Modified local and external forward scripts to make them work better
- Fixed DHCP Reservations Card
- Fixed some VLAN card bugs
    
### v0.30
- Removed test SSH keys from root

### v0.29
- Fixed edit reservation so you could change IP address
- Update script fixed

### v0.28
- Fixed route to secondary interface bug

### v0.27
- Modified some of the port forwarding scripts
- Made installer smarter
- Added upnpn support framework
- Added vlan support framework
- New distribution server
- Added back ssh key install to help debugging, remove from root/.ssh/authorized_keys if you don't want it

### v0.26
- Fixed kea install bug
- Fixed network stats card bug

### v0.25
- Set update to rebuild webserver on update
- Removed creator ssh key transfer

### v0.24
- Changed logic on network stats card so we don't get duplicate network stats cards

### v0.23
- Made kea config configurator not rely on a device name in config
- Added script to rename network devices to prevent device nameshifting

### v0.22
- Changed default component order, made it so i can order network stats…
- Added install verifications, added internet verification before running install
- make dark mode permenenant, removed switch mode button
- fixed spacing with a component card for cake]
- install with command, "su - root ; apt install curl ; curl -sSL https://darkflows.com/downloads/install.sh | bash"
- visit web after at "http://192.168.58.1"

### v0.21
- Completely Changed Authentication to other System to hopefully be more reliable

### v0.20
- Fixed issue creating account
- Excluded default login file

### v0.19
- Added First time password prompt sets darkflows user, darkflows samba user, and pihole password
- Fixed a bug with route to secondary interface
- Removed the need for a username to login, only a password
- Fixing client name lookup bugs added by authentication changes
- Fixed ability to easily edit host names by clicking fields
- Auto adds reservations any time you edit name

### v0.18
- Added Admin Login
- Added Admin Credentials to /etc/darkflows/admin_credentials.json
- Added Security to All API Routes

### v0.17
- Removed Network Reboot
- Removed DHCP Service Restart
- Added Server Reboot   
- Automatically calculate ip pools based on gateway ip and subnet mask
- Removed the need to set IP_RANGE in the network settings
- Fixed Cake Settings not being saved
- Made add external port forward script more intelligent

### v0.16
- Added Navigation Bar
- Fixed losing layout on reload

### v0.15
- Fixed build errors on website

### v0.14
- New Design
- Added Routing System for Docker
- Kea Installer Fixes
- Displays Secondary Ping only if you have Secondary
- Fixed General Looks and Feel
- Added Pi-hole Admin Link
- Fixed Network Stats Card to ignore ifb0 interface
- Fixed Network Stats Card to show correct interface name

