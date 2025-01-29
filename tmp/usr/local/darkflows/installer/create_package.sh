#!/bin/sh
DARKFLOWS_DIR="/usr/local/darkflows"
PACKAGE_DIR="/usr/local/installer_packages"

# Read first line of version.txt and strip whitespace/newlines
VERSION=$(head -n1 $DARKFLOWS_DIR/version.txt | tr -d '\r\n' | tr -d ' ')

rm $PACKAGE_DIR/*
echo cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
$DARKFLOWS_DIR/installer/create_backup.sh
cd $PACKAGE_DIR
tar zcvf /tmp/darkflows-v${VERSION}.tgz *
echo "package is in /tmp/darkflows-v${VERSION}.tgz"
scp -P 8020 /tmp/darkflows-v${VERSION}.tgz root@darkflows.com:/var/www/darkflows.com/downloads/

