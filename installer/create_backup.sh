#!/bin/bash
cd /usr/local/darkflows/src/live-ifstat

mkdir /usr/local/installer_packages

# Generate random suffix for darkflows directory
DARKFLOWS_SUFFIX="$RANDOM"
DARKFLOWS_BACKUP="/etc/darkflows.$DARKFLOWS_SUFFIX"
KEA_BACKUP="/etc/kea.$DARKFLOWS_SUFFIX"
UNBOUND_BACKUP="/etc/unbound.$DARKFLOWS_SUFFIX"


/usr/local/darkflows/src/live-ifstat/.session-secret

# Move darkflows to temporary name and replace with default
mv /etc/darkflows "$DARKFLOWS_BACKUP"
mv /etc/darkflows.default /etc/darkflows

mv /etc/kea "$KEA_BACKUP"
mv /etc/kea.default /etc/kea

mv /etc/unbound "$UNBOUND_BACKUP"
mv /etc/unbound.default /etc/unbound


# Create the archives with the default config in place
tar zcvf /usr/local/installer_packages/darkflows_scripts.tgz  --exclude=node_modules --exclude=.next --exclude=installer_packages --exclude=.git  /usr/local/darkflows /etc/systemd/system/nextjs-app.service /etc/systemd/system/default_routing.service 

# Paths to the configs
SAMBA_CONF="/etc/samba/smb.conf"

# Backup original files with random suffix
SAMBA_CONF_BACKUP="/etc/samba/smb.conf.$RANDOM"

# Back up original files by renaming them
mv "$SAMBA_CONF" "$SAMBA_CONF_BACKUP"

# Create filtered versions of the configs
#sed '/^\[.*-hide\]/,/^$/d' "$SAMBA_CONF_BACKUP" > "$SAMBA_CONF"
cp $SAMBA_CONF.default $SAMBA_CONF


# Create the archive
tar zcvf /usr/local/installer_packages/darkflows_configs.tgz \
    --exclude=installer_packages \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=.next \
    --exclude=admin_credentials.json \
    --exclude=vlans.json \
    /etc/kea  /etc/darkflows /etc/ssh/sshd_config  /etc/samba /etc/unbound  /etc/docker/daemon.json

mkdir /usr/local/darkflows/configs/
cp /usr/local/installer_packages/darkflows_configs.tgz /usr/local/darkflows/configs/
# Remove filtered temporary files
rm -f "$SAMBA_CONF"


# Restore the original config files
mv "$SAMBA_CONF_BACKUP" "$SAMBA_CONF"

# Restore original darkflows directory
mv /etc/darkflows /etc/darkflows.default
mv "$DARKFLOWS_BACKUP" /etc/darkflows

mv /etc/kea /etc/kea.default
mv "$KEA_BACKUP" /etc/kea

mv /etc/unbound /etc/unbound.default
mv "$UNBOUND_BACKUP" /etc/unbound

cd /usr/local/darkflows/src/live-ifstat/
npm run build
systemctl restart nextjs-app

echo "Backup completed successfully."

