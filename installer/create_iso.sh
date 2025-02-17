#!/bin/sh

#boot/grub/grub.cfg  for efi isolinux.cfg for bios
#  mkdir -p /nvme_array/darkflows_iso/iso
#  cd /nvme_array/darkflows_iso
#  wget https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.8.0-amd64-netinst.iso
#  mount -o loop debian-12.8.0-amd64-netinst.iso iso
#  mkdir custom_iso
#  cp -rT iso custom_iso

cd /nvme_array/darkflows_iso/custom_iso/darkflows
#scp -P 12222 root@192.168.1.1:/usr/local/installer_packages/darkflows_scripts.tgz .
#scp -P 12222 root@192.168.1.1:/usr/local/installer_packages/darkflows_configs.tgz .
wget https://darkflows.com/downloads/darkflows-current.tgz
cd /nvme_array/darkflows_iso/custom_iso
xorriso -as mkisofs -o ../darkflows-installer.iso     -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin     -c isolinux/boot.cat     -b isolinux/isolinux.bin     -no-emul-boot -boot-load-size 4 -boot-info-table     -eltorito-alt-boot     -e boot/grub/efi.img     -no-emul-boot     -isohybrid-gpt-basdat     -volid "DARKFLOWS_INSTALL" .
/usr/bin/cp  ../darkflows-installer.iso /nvme_array/proxmox/template/iso/

