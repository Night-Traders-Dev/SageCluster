#!/bin/bash
# LicheeRV Cluster Watchdog
# Runs on OrangePi but serves as the LicheeRV's watchdog service
LOG=/tmp/watchdog.log
SLEEP=60

# Node config: "host user sudo_pwd"
NODES=(
  "192.168.254.44 orangepi jdy@123"
  "10.42.0.141 ubuntu jdy@123"
  "10.42.1.109 evelyn"
  "192.168.254.25 root jdy@123"
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

check_node() {
  local host=$1 user=$2 sudo_pwd=$3
  local ssh_cmd="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $user@$host"

  # Ping check
  if ! ping -c1 -W3 "$host" &>/dev/null; then
    log "WARN $host ($user) — ping failed"
    return
  fi

  # RAM check
  local mem_line
  mem_line=$($ssh_cmd "free -m 2>/dev/null | awk '/Mem:/ {print \$2,\$3}'" 2>/dev/null) || {
    log "WARN $host ($user) — SSH failed"
    return
  }

  local total_mb=$(echo "$mem_line" | cut -d' ' -f1)
  local used_mb=$(echo "$mem_line" | cut -d' ' -f2)
  local free_pct=0
  if [ "$total_mb" -gt 0 ] 2>/dev/null; then
    free_pct=$(( (total_mb - used_mb) * 100 / total_mb ))
  fi

  log "OK $host ($user) — RAM ${free_pct}% free (${used_mb}/${total_mb} MB)"

  if [ "$free_pct" -lt 20 ]; then
    log "ACTION $host ($user) — RAM below 20%, dropping caches"
    if [ -n "$sudo_pwd" ]; then
      $ssh_cmd "echo '$sudo_pwd' | sudo -S sh -c 'sync && echo 3 > /proc/sys/vm/drop_caches && fstrim -A -v'" 2>>"$LOG"
    else
      $ssh_cmd "sudo sh -c 'sync && echo 3 > /proc/sys/vm/drop_caches && fstrim -A -v'" 2>>"$LOG"
    fi
    if [ $? -eq 0 ]; then
      log "DONE $host ($user) — caches dropped + fstrim completed"
    else
      log "FAIL $host ($user) — cache drop command failed"
    fi
  fi
}

log "=== Watchdog started ==="
while true; do
  for node in "${NODES[@]}"; do
    check_node $node
  done
  log "--- cycle complete, sleeping ${SLEEP}s ---"
  sleep "$SLEEP"
done
