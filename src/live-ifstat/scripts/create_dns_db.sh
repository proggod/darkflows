#!/bin/bash

mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS dns_logs;
USE dns_logs;
CREATE TABLE IF NOT EXISTS whitelist (domain VARCHAR(255) PRIMARY KEY);
CREATE TABLE IF NOT EXISTS blacklist (domain VARCHAR(255) PRIMARY KEY);
EOF

echo "DNS database and tables created successfully" 