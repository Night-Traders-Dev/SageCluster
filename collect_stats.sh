#!/bin/bash
echo "KERNEL:$(uname -a)"
echo "OS:$(cat /etc/os-release 2>/dev/null | grep ^PRETTY_NAME= | cut -d= -f2- | tr -d '"' || echo unknown)"
UPTIME_STR=$(uptime -p 2>/dev/null)
if [ -z "$UPTIME_STR" ]; then
  s=$(cat /proc/uptime 2>/dev/null | cut -d' ' -f1 | cut -d. -f1)
  d=$((s/86400))
  h=$(((s%86400)/3600))
  m=$(((s%3600)/60))
  UPTIME_STR="up ${d} days, ${h} hours, ${m} minutes"
fi
echo "UPTIME:$UPTIME_STR"
echo "LOAD:$(cat /proc/loadavg | cut -d' ' -f1-3 2>/dev/null || echo unknown)"
echo "STORAGE:$(df -m / 2>/dev/null | tail -1 | awk '{print $2,$3,$4,$5}' || echo 'unknown unknown unknown unknown')"
BLOCK_DEVS=$(df -m 2>/dev/null | grep '^/dev/' | awk '!/loop/{printf "%s|%s|%s|%s|%s|%s;", $1, $6, $2, $3, $4, $5}')
echo "BLOCK_DEVICES:${BLOCK_DEVS:-none}"
MODEL=$( (grep -m1 'model name' /proc/cpuinfo 2>/dev/null || tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo unknown) | awk -F: '{print $NF}' | xargs )
echo "CPU_MODEL:$MODEL"
echo "CPU_TEMP:$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo N/A)"
echo "MEM:$(free -m | awk '/Mem:/ {print $2","$3}')"
echo "SWAP:$(free -m | awk '/Swap:/ {print $2","$3}')"
echo "PROCS:$(ps aux 2>/dev/null | wc -l || echo 0)"
echo "NET:$(cat /proc/net/dev 2>/dev/null | tail -n+3 | grep -v lo | head -1 | awk '{print $2,$10}' || echo '0 0')"
echo "DISK_IO:$(cat /proc/diskstats 2>/dev/null | grep -E 'sd[a-z] |mmcblk[0-9] |nvme[0-9]' | head -1 | awk '{print $6,$10}' || echo '0 0')"
echo "ARCH:$(uname -m)"
echo "CPUS:$(nproc)"
