k#!/bin/sh
DARKFLOWS_DIR="/usr/local/darkflows"
PACKAGE_DIR="/usr/local/installer_packages"
VERSION=$(head -n1 $DARKFLOWS_DIR/version.txt | tr -d '\r')  # Get cleaned version number

rm $PACKAGE_DIR/*
echo cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
$DARKFLOWS_DIR/installer/create_backup.sh
cd $PACKAGE_DIR
tar zcvf /tmp/darkflows-${VERSION}.tgz *
echo "package is in /tmp/darkflows-${VERSION}.tgz"
scp -P 8020 /tmp/darkflows-${VERSION}.tgz root@darkflows.com:/var/www/darkflows.com/downloads/


