#!/bin/bash
tar zcvf /tmp/darkflows_scripts.tgz --exclude=.git --exclude=node_modules --exclude=.next /etc/kea /etc/lighttpd /var/www /usr/local/darkflows /etc/systemd/system/nextjs-app.service /etc/systemd/system/default_routing.service /etc/darkflows /root/.ssh/authorized_keys /etc/ssh/sshd_config

#systemctl daemon-reload
#systemctl enable default_routing.service
#systemctl enable nextjs-app.service
#
#systemctl start default_routing.service
#systemctl start nextjs-app.service
#
#npm install -g pnpm
#pnpm install --legacy-peer-deps

