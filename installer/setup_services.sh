#!/bin/bash
systemctl daemon-reload
systemctl enable default_routing.service
systemctl enable nextjs-app.service

systemctl restart default_routing.service
systemctl restart nextjs-app.service
systemctl restart iperf3.service
systemctl restart irqbalance.service
systemctl restart kea-dhcp4-server.service
systemctl restart mariadb.service
systemctl restart nmbd.service
systemctl restart ssh.service
systemctl restart smbd.service


