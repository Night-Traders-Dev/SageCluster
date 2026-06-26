#!/bin/bash

echo "=== OrangePi RV2 ==="
hostname
uname -m
nproc
free -h | grep Mem
uptime -p

echo
echo "=== Raspberry Pi 4 ==="
ssh ubuntu@10.42.0.141 '
echo "Host: $(hostname)"
echo "Arch: $(uname -m)"
echo "CPUs: $(nproc)"
free -h | grep Mem
uptime -p
'

echo
echo "=== Raspberry Pi 2 ==="
ssh evelyn@10.42.1.109 '
echo "Host: $(hostname)"
echo "Arch: $(uname -m)"
echo "CPUs: $(nproc)"
free -h | grep Mem
uptime -p
'
