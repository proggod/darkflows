k#!/bin/bash
DARKFLOWS_DIR="/usr/local/darkflows"
PACKAGE_DIR="/usr/local/installer_packages"
VERSION=$(head -n1 $DARKFLOWS_DIR/version.txt | tr -d '\r')  # Get cleaned version number

rm $PACKAGE_DIR/*
echo cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
echo cp $DARKFLOWS_DIR/installer/update_darkflows.sh $PACKAGE_DIR/
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
$DARKFLOWS_DIR/installer/create_backup.sh
cd $PACKAGE_DIR
tar zcvf /tmp/darkflows-${VERSION}.tgz *
echo "package is in /tmp/darkflows-${VERSION}.tgz"
cd /tmp
rm darkflows-current.tgz
ln -s darkflows-${VERSION}.tgz darkflows-current.tgz
scp -P 8020 /tmp/darkflows-${VERSION}.tgz root@darkflows.com:/var/www/darkflows.com/downloads/
scp -P 8020 /tmp/darkflows-current.tgz root@darkflows.com:/var/www/darkflows.com/downloads/


