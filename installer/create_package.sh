#!/bin/sh
DARKFLOWS_DIR="/usr/local/darkflows"

rm $DARKFLOWS_DIR/installer_packages/*
cp $DARKFLOWS_DIR/installer/install_darkflows.sh $DARKFLOWS_DIR/package/
$DARKFLOWS_DIR/installer/create_backup.sh
cp $DARKFLOWS_DIR/installer_packages/* $DARKFLOWS_DIR/package/
cd $DARKFLOWS_DIR/package
tar zcvf /tmp/darkflows.tgz *

