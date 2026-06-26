# Deployment

## Prerequisites

- Python 3.11+ with pip
- SSH key‑based auth from OrangePi to all other nodes
- NFS utilities (`nfs-common`) on OrangePi
- NFS server exports from Pi4 mounted at `/mnt/storage` on OrangePi

## Install

```bash
cd ~/SageCluster
pip install fastapi uvicorn python-multipart
```

## Run

### Dashboard (production)

```bash
sudo systemctl start sagecluster-dashboard
# Or manually:
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
```

The systemd service is at `/etc/systemd/system/sagecluster-dashboard.service` and is enabled for auto‑start.

### Cloudflare Tunnel (systemd)

```bash
sudo systemctl start cloudflared-tunnel
```

### Tailscale Funnel

```bash
sudo tailscale funnel --bg 8080
```

Persists across restarts via tailscale config.

## Updates

Pull the latest code and restart:

```bash
cd ~/SageCluster && git pull
sudo systemctl restart sagecluster-dashboard
```

If the cache‑busting version (`?v=N`) hasn't changed, bump it in `templates/index.html` and do a hard refresh in your browser.

## Files

| Path | Purpose |
|------|---------|
| `main.py` | FastAPI app — all API endpoints |
| `config.py` | Node IP/user definitions |
| `collector.py` | Parallel SSH stats collection |
| `collect_stats.sh` | Shell script run on each node |
| `file_manager.py` | File management API |
| `settings.json` | Persisted configuration |
| `watchdog.sh` | Cluster watchdog daemon |
| `templates/index.html` | Dashboard HTML |
| `templates/files.html` | File manager HTML |
| `static/js/app.js` | Main polling, DOM updates |
| `static/js/charts.js` | Chart definitions, overlay |
| `static/js/nodes.js` | Node card rendering |
| `static/js/history.js` | localStorage persistence |
| `static/js/settings.js` | Settings panel |
| `static/js/files.js` | File manager logic |

## Network Services

| Service | Node | Port | Auth |
|---------|------|------|------|
| Dashboard | OrangePi | 8080 | — |
| File Manager | OrangePi | 8080/files | Password |
| Pi‑hole Admin | Pi2 | 80 | `admin`/`admin` |
| Prometheus | Pi4 | 9090 | — |
| Grafana | Pi4 | 3000 | `admin`/`admin` |
| WireGuard | Pi4 | 51820 | Public key |
| NFS | Pi4 | 2049 | IP ACL |
| Cloudflare | OrangePi | ephemeral | Random URL |
| Tailscale Funnel | OrangePi | 443 | Tailnet auth |
