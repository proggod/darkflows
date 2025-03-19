#!/bin/sh

/usr/local/darkflows/installer/create_package.sh
mkdir /usr/local/darkflows_iso/custom_iso/darkflows
cd /usr/local/darkflows_iso/custom_iso
cp preseed.cfg /usr/local/darkflows/installer/
cp isolinux/isolinux.cfg /usr/local/darkflows/installer/

xorriso -as mkisofs -o ../darkflows.iso     -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin     -c isolinux/boot.cat     -b isolinux/isolinux.bin     -no-emul-boot -boot-load-size 4 -boot-info-table     -eltorito-alt-boot     -e boot/grub/efi.img     -no-emul-boot     -isohybrid-gpt-basdat     -volid "DARKFLOWS_INSTALL" .
scp -P 12222 ../darkflows.iso ny:/var/www/darkflows.com/downloads
scp ../darkflows.iso 192.168.1.110:/nvme_array/proxmox/template/iso

