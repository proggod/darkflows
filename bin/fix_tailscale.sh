#!/bin/bash
chattr -i /etc/resolv.conf
tailscale down
tailscale up
chattr +i /etc/resolv.conf

