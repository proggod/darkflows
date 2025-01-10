#!/bin/bash
cd /
tar zxvf /tmp/darkflows_scripts.tgz
systemctl daemon-reload
systemctl enable default_routing.service
systemctl enable nextjs-app.service

systemctl start default_routing.service
systemctl start nextjs-app.service

cd /usr/local/darkflows/src/live-ifstat/
npm install -g pnpm
pnpm install --strict-peer-dependencies=false


