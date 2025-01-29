#!/bin/bash
cd /usr/local/darkflows/src/live-ifstat
npm prune --production

mkdir /usr/local/installer_packages
tar zcvf /usr/local/installer_packages/darkflows_scripts.tgz  --exclude=node_modules --exclude=.next --exclude=installer_packages --exclude=.git  /usr/local/darkflows /etc/systemd/system/nextjs-app.service /etc/systemd/system/default_routing.service 

# Paths to the configs
SAMBA_CONF="/etc/samba/smb.conf"
KEA_CONF="/etc/kea/kea-dhcp4.conf"

# Backup original files with random suffix
SAMBA_CONF_BACKUP="/etc/samba/smb.conf.$RANDOM"
KEA_CONF_BACKUP="/etc/kea/kea-dhcp4.conf.$RANDOM"

# Back up original files by renaming them
mv "$SAMBA_CONF" "$SAMBA_CONF_BACKUP"
mv "$KEA_CONF" "$KEA_CONF_BACKUP"

# Create filtered versions of the configs
#sed '/^\[.*-hide\]/,/^$/d' "$SAMBA_CONF_BACKUP" > "$SAMBA_CONF"
#jq 'del(.Dhcp4.subnet4[].reservations)' "$KEA_CONF_BACKUP" > "$KEA_CONF"
cp $SAMBA_CONF.default $SAMBA_CONF
cp $KEA_CONF.default $KEA_CONF  


# Create the archive
tar zcvf /usr/local/installer_packages/darkflows_configs.tgz \
    --exclude=installer_packages \
    --exclude=.git \
    --exclude=node_modules \
    --exclude=.next \
    /etc/kea /etc/lighttpd /etc/darkflows /root/.ssh/authorized_keys /etc/ssh/sshd_config  /var/www/html/index.php /etc/samba /etc/darkflows

mkdir /usr/local/darkflows/configs/
cp /usr/local/installer_packages/darkflows_configs.tgz /usr/local/darkflows/configs/
# Remove filtered temporary files
rm -f "$SAMBA_CONF"
rm -f "$KEA_CONF"

# Restore the original config files
mv "$SAMBA_CONF_BACKUP" "$SAMBA_CONF"
mv "$KEA_CONF_BACKUP" "$KEA_CONF"

echo "Backup completed successfully."

