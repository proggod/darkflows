#!/bin/bash

USERNAME="darkflows"
PASSWORD="darkflows"

# Add the user
adduser --disabled-password --gecos "" "$USERNAME"

# Set the password
echo "$USERNAME:$PASSWORD" | chpasswd
echo "root:$PASSWORD" | chpasswd

# Add the user to the sudo group
usermod -aG sudo "$USERNAME"

echo "User $USERNAME has been created and can su to root."


