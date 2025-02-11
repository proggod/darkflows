#!/bin/bash
DARKFLOWS_DIR="/usr/local/darkflows"
PACKAGE_DIR="/usr/local/installer_packages"
VERSION=$(head -n1 $DARKFLOWS_DIR/version.txt | tr -d '\r')  # Get cleaned version number

# Check for --dev flag
DEV_MODE=0
if [ "$1" == "--dev" ]; then
    DEV_MODE=1
fi

rm $PACKAGE_DIR/*
echo cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
echo cp $DARKFLOWS_DIR/installer/update_darkflows.sh $PACKAGE_DIR/
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
$DARKFLOWS_DIR/installer/create_backup.sh
cd $PACKAGE_DIR
tar zcvf /tmp/darkflows-${VERSION}.tgz *
echo "package is in /tmp/darkflows-${VERSION}.tgz"
cd /tmp
rm -f darkflows-current.tgz
ln -s darkflows-${VERSION}.tgz darkflows-current.tgz

# Only perform SCP if not in dev mode
if [ $DEV_MODE -eq 0 ]; then
    scp -P 12222 /tmp/darkflows-${VERSION}.tgz root@darkflows.com:/var/www/darkflows.com/downloads/
    scp -P 12222 /tmp/darkflows-current.tgz root@darkflows.com:/var/www/darkflows.com/downloads/
else
    echo "Dev mode: Skipping SCP of files to remote server"
fi


