#!/bin/bash

#apt install -y nodejs npm
cd /usr/local/darkflows/src/live-ifstat

# Install required dependencies including autoprefixer and postcss
npm install autoprefixer postcss

# Install other dependencies and build
npm install
npm run build

