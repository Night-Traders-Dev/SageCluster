import json, os, subprocess, time

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import NODES
from collector import collect_all

app = FastAPI(title="SageCluster")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

NODE_IDS = ["orangepi", "pi4", "pi2", "licheerv"]

BASE = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(BASE, "settings.json")

DEFAULT_SETTINGS = {
    "dashboard": {"poll_interval": 5, "history_points": 500},
    "watchdog": {"enabled": True, "check_interval": 60, "ram_threshold": 20, "nodes": ["orangepi", "pi4", "pi2", "licheerv"]},
    "pihole": {"upstream_dns_1": "1.1.1.1", "upstream_dns_2": "8.8.8.8"},
    "nfs": {"exports": [
        {"path": "/mnt/storage/backup", "networks": ["10.42.0.0/24", "192.168.254.0/24"]},
        {"path": "/mnt/storage/crossbuild", "networks": ["10.42.0.0/24", "192.168.254.0/24"]}
    ]},
    "prometheus": {"scrape_interval": 15, "scrape_targets": ["localhost:9090", "localhost:9100", "10.42.0.1:9100", "10.42.1.109:9100", "192.168.254.25:9100"]},
    "wireguard": {"peers": []},
    "nodes": {
        "orangepi": {"host": "localhost", "user": "", "sudo_password": "jdy@123"},
        "pi4": {"host": "10.42.0.141", "user": "ubuntu", "sudo_password": "jdy@123"},
        "pi2": {"host": "10.42.1.109", "user": "evelyn", "sudo_password": ""},
        "licheerv": {"host": "192.168.254.25", "user": "root", "sudo_password": "jdy@123"}
    }
}

def load_settings():
    try:
        with open(SETTINGS_FILE) as f:
            return json.load(f)
    except Exception:
        save_settings(DEFAULT_SETTINGS)
        return dict(DEFAULT_SETTINGS)

def save_settings(s):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(s, f, indent=2)

def run_ssh(cmd, timeout=10):
    try:
        return subprocess.check_output(cmd, shell=True, timeout=timeout, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return None

def write_remote(host, user, remote_path, content):
    cmd = f"ssh -oConnectTimeout=5 {user}@{host} 'sudo tee {remote_path}'"
    try:
        subprocess.run(cmd, shell=True, input=content.encode(), timeout=10, check=True, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/status")
async def status():
    o, p4, p2, li = collect_all()
    nodes = {"orangepi": o, "pi4": p4, "pi2": p2, "licheerv": li}
    total_cpu = sum(int(n.get("cpus", 0)) for n in nodes.values() if n.get("cpus"))
    total_mem = used_mem = 0
    swap_total = swap_used = 0
    for n in nodes.values():
        mem = n.get("mem")
        if mem:
            try:
                t, u = map(int, mem.split(","))
                total_mem += t
                used_mem += u
            except:
                pass
        sw = n.get("swap")
        if sw:
            try:
                parts = sw.split(",")
                swap_total += int(parts[0])
                swap_used += int(parts[1])
            except:
                pass
    return JSONResponse({
        "cluster": {
            "total_cpu": total_cpu, "total_mem_mb": total_mem, "used_mem_mb": used_mem,
            "swap_total_mb": swap_total, "swap_used_mb": swap_used,
        },
        "nodes": nodes, "timestamp": time.time(),
    })


@app.get("/api/logs/{component}")
async def component_log(component: str):
    cmds = {
        "nfs": "ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo journalctl -u nfs-server --no-pager -n 100 2>/dev/null || echo \"NFS log unavailable\"'",
        "prometheus": "ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo journalctl -u prometheus --no-pager -n 100 2>/dev/null || echo \"Prometheus log unavailable\"'",
        "grafana": "ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo journalctl -u grafana-server --no-pager -n 100 2>/dev/null || echo \"Grafana log unavailable\"'",
        "wireguard": "ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo wg show 2>/dev/null; echo ---; sudo systemctl status wg-quick@wg0 --no-pager -n 20 2>/dev/null || echo \"WireGuard not running\"'",
        "pihole": "ssh -oConnectTimeout=5 evelyn@10.42.1.109 'sudo -n tail -100 /var/log/pihole/pihole.log 2>/dev/null || echo \"Pi-hole log empty\"'",
    }
    if component == "watchdog":
        try:
            with open("/tmp/watchdog.log") as f:
                lines = f.readlines()
            return JSONResponse({"log": "".join(lines[-100:])})
        except FileNotFoundError:
            return JSONResponse({"log": "Watchdog not started yet."})
    cmd = cmds.get(component)
    if not cmd:
        return JSONResponse({"log": "Unknown component."})
    out = run_ssh(cmd)
    return JSONResponse({"log": out or f"Failed to fetch {component} log."})


@app.get("/api/settings")
async def get_settings():
    return JSONResponse(load_settings())


@app.put("/api/settings")
async def update_settings(data: dict):
    save_settings(data)
    return JSONResponse({"status": "saved"})


@app.post("/api/apply")
async def apply_settings():
    s = load_settings()
    results = []

    # Prometheus
    targets = s.get("prometheus", {}).get("scrape_targets", [])
    scrape_interval = s.get("prometheus", {}).get("scrape_interval", 15)
    prom_cfg = f"""global:
  scrape_interval: {scrape_interval}s
  evaluation_interval: {scrape_interval}s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']
  - job_name: node
    static_configs:
      - targets: [{', '.join(f"'{t}'" for t in targets)}]
  - job_name: cluster-dashboard
    metrics_path: /api/prometheus-metrics
    static_configs:
      - targets: ['192.168.254.44:8080']
"""
    ok = write_remote("10.42.0.141", "ubuntu", "/etc/prometheus/prometheus.yml", prom_cfg)
    if ok:
        run_ssh("ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo systemctl restart prometheus'")
    results.append({"component": "prometheus", "status": "applied" if ok else "failed"})

    # NFS
    nfs_exports = s.get("nfs", {}).get("exports", [])
    lines = [f'{exp["path"]} {" ".join(exp.get("networks", []))}(rw,sync,no_subtree_check)' for exp in nfs_exports]
    ok = write_remote("10.42.0.141", "ubuntu", "/etc/exports", "\n".join(lines) + "\n")
    if ok:
        run_ssh("ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo exportfs -a && sudo systemctl restart nfs-server'")
    results.append({"component": "nfs", "status": "applied" if ok else "failed"})

    # WireGuard
    peers = s.get("wireguard", {}).get("peers", [])
    wg_body = "\n\n".join(f"[Peer]\nPublicKey = {p['public_key']}\nAllowedIPs = {p['allowed_ips']}" for p in peers)
    priv = run_ssh("ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo cat /etc/wireguard/private.key 2>/dev/null'") or "QKt2qMRJBbHO009vasAsQM4fz25YP3BfbxJ/Ja7hgWY="
    wg_cfg = f"""[Interface]
PrivateKey = {priv}
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = false

{wg_body}
"""
    ok = write_remote("10.42.0.141", "ubuntu", "/etc/wireguard/wg0.conf", wg_cfg)
    if ok:
        run_ssh("ssh -oConnectTimeout=5 ubuntu@10.42.0.141 'sudo systemctl restart wg-quick@wg0'")
    results.append({"component": "wireguard", "status": "applied" if ok else "failed"})

    # Pi-hole DNS
    dns1 = s.get("pihole", {}).get("upstream_dns_1", "1.1.1.1")
    dns2 = s.get("pihole", {}).get("upstream_dns_2", "8.8.8.8")
    ok = write_remote("10.42.1.109", "evelyn", "/etc/pihole/setupVars.conf.update",
                      f"PIHOLE_DNS_1={dns1}\nPIHOLE_DNS_2={dns2}\n")
    if ok:
        run_ssh("ssh -oConnectTimeout=5 evelyn@10.42.1.109 'sudo pihole restartdns 2>/dev/null; echo restart issued'")
    results.append({"component": "pihole", "status": "applied" if ok else "failed"})

    # Watchdog
    wd_enabled = s.get("watchdog", {}).get("enabled", True)
    if wd_enabled:
        wd_interval = s.get("watchdog", {}).get("check_interval", 60)
        wd_threshold = s.get("watchdog", {}).get("ram_threshold", 20)
        wd_nodes = s.get("watchdog", {}).get("nodes", [])
        node_lines = []
        for nid in wd_nodes:
            ns = s.get("nodes", {}).get(nid, {})
            h = ns.get("host", nid)
            u = ns.get("user", "root")
            p = ns.get("sudo_password", "")
            node_lines.append(f'  "{h} {u} {p}"')
        nl = "\n".join(node_lines)
        wd_script = f"""#!/bin/bash
LOG=/tmp/watchdog.log
SLEEP={wd_interval}
NODES=(
{nl}
)
log() {{ echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }}
check_node() {{
  local host=$1 user=$2 sudo_pwd=$3
  local ssh_cmd="ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $user@$host"
  if ! ping -c1 -W3 "$host" &>/dev/null; then
    log "WARN $host ($user) — ping failed"; return
  fi
  local mem_line=$($ssh_cmd "free -m 2>/dev/null | awk '/Mem:/ {{print $2,$3}}'" 2>/dev/null) || {{ log "WARN $host ($user) — SSH failed"; return; }}
  local total_mb=$(echo "$mem_line" | cut -d' ' -f1)
  local used_mb=$(echo "$mem_line" | cut -d' ' -f2)
  local free_pct=0
  if [ "$total_mb" -gt 0 ] 2>/dev/null; then free_pct=$(( (total_mb - used_mb) * 100 / total_mb )); fi
  log "OK $host ($user) — RAM ${free_pct}% free (${used_mb}/${total_mb} MB)"
  if [ "$free_pct" -lt {wd_threshold} ]; then
    log "ACTION $host ($user) — RAM below {wd_threshold}%, dropping caches"
    if [ -n "$sudo_pwd" ]; then
      $ssh_cmd "echo '$sudo_pwd' | sudo -S sh -c 'sync && echo 3 > /proc/sys/vm/drop_caches && fstrim -A -v'" 2>>"$LOG"
    else
      $ssh_cmd "sudo sh -c 'sync && echo 3 > /proc/sys/vm/drop_caches && fstrim -A -v'" 2>>"$LOG"
    fi
    log "DONE $host ($user) — caches dropped"
  fi
}}
log "=== Watchdog started ==="
while true; do
  for node in "${{NODES[@]}}"; do check_node $node; done
  log "--- cycle complete, sleeping ${{SLEEP}}s ---"
  sleep "$SLEEP"
done
"""
        wd_path = os.path.join(BASE, "watchdog.sh")
        with open(wd_path, "w") as f:
            f.write(wd_script)
        os.chmod(wd_path, 0o755)
        run_ssh("pkill -f watchdog.sh 2>/dev/null; nohup bash ~/SageCluster/watchdog.sh >/dev/null 2>&1 &")
    results.append({"component": "watchdog", "status": "applied"})

    return JSONResponse({"status": "ok", "results": results})


@app.get("/api/prometheus-metrics")
async def prometheus_metrics():
    from fastapi.responses import PlainTextResponse
    lines = [
        "# HELP sagecluster_up Node reachable",
        "# TYPE sagecluster_up gauge",
    ]
    for nid in ["orangepi", "pi4", "pi2", "licheerv"]:
        lines.append(f'sagecluster_up{{node="{nid}"}} 1')
    lines.append(f"# HELP sagecluster_timestamp Timestamp")
    lines.append(f"# TYPE sagecluster_timestamp gauge")
    lines.append(f"sagecluster_timestamp {time.time()}")
    return PlainTextResponse("\n".join(lines) + "\n")
