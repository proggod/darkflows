#!/bin/sh
DARKFLOWS_DIR="/usr/local/darkflows"
PACKAGE_DIR="/usr/local/installer_packages"
rm $PACKAGE_DIR/*
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $PACKAGE_DIR/
$DARKFLOWS_DIR/installer/create_backup.sh
cd $PACKAGE_DIR
tar zcvf /tmp/darkflows.tgz *
echo "package is in /tmp/darkflows.tgz"

