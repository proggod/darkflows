#!/bin/bash
set -e

# Ensure the script is run non-interactively.
export DEBIAN_FRONTEND=noninteractive

# Update package list and install required packages.
apt-get update -qq
apt-get install -y nginx openssl

# Create directory for self-signed certificates.
CERT_DIR="/etc/nginx/ssl"
mkdir -p "$CERT_DIR"

# Generate a self-signed certificate valid for 365 days.
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/nginx-selfsigned.key" \
  -out "$CERT_DIR/nginx-selfsigned.crt" \
  -subj "/CN=localhost"

# Create the nginx configuration for the Next.js proxy.
NGINX_CONF="/etc/nginx/sites-available/nextjs-proxy"
cat > "$NGINX_CONF" << 'EOF'
# Redirect HTTP to HTTPS.
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS server block.
server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;

    location / {
        proxy_pass http://localhost:4080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Disable the default site if it exists.
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Enable our new configuration.
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/nextjs-proxy

# Test the configuration and reload nginx.
nginx -t && systemctl reload nginx

echo "Nginx is now set up as a reverse proxy for your Next.js app on port 4080 with a self-signed certificate."

