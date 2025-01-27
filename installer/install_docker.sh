#!/bin/sh
apt update
apt -o Dpkg::Options::="--force-confold" --assume-yes install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt -o Dpkg::Options::="--force-confold" --assume-yes install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

