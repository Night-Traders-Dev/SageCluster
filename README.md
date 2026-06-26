# SageCluster

A real-time cluster dashboard for monitoring and managing multiple Linux nodes — OrangePi, Raspberry Pi 4, Raspberry Pi 2, and LicheeRV Nano — with live graphs, persistent history, service logs, and centralized settings.

## Architecture

OrangePi (dashboard) runs FastAPI/uvicorn on :8080 with parallel SSH collection to all nodes. Pi4 hosts NFS, Prometheus, Grafana, WireGuard, and 128GB USB storage. Pi2 runs Pi-hole DNS. LicheeRV runs Buildroot.

Networks: 192.168.254.0/24 (WiFi LAN), 10.42.0.0/24 (Pi4 VLAN), 10.42.1.0/24 (Pi2 VLAN), 10.0.0.0/24 (WireGuard on Pi4 :51820).

## Structure

```
SageCluster/
├── main.py              # FastAPI app — status, logs, settings APIs
├── config.py            # Node IP/user configuration
├── collector.py         # Parallel SSH stats collection
├── collect_stats.sh     # Shell script run on each node
├── settings.json        # Persisted settings (auto-created)
├── watchdog.sh          # Cluster watchdog daemon
├── cluster.sh           # Convenience script
├── templates/
│   └── index.html       # Dashboard HTML template
├── static/js/
│   ├── history.js       # localStorage persistence (500 pts/metric)
│   ├── nodes.js         # Node card rendering & accordion toggle
│   ├── charts.js        # Chart.js definitions & overlay management
│   ├── settings.js      # Settings panel UI
│   └── app.js           # Main polling, DOM updates, init
└── README.md
```

## Run

```bash
cd SageCluster
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Open `http://<ORANGEPI_IP>:8080`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Cluster + per-node status |
| `/api/logs/{component}` | GET | Logs for watchdog, pihole, nfs, prometheus, grafana, wireguard |
| `/api/settings` | GET | Current settings JSON |
| `/api/settings` | PUT | Update settings |
| `/api/apply` | POST | Apply settings to remote services |
| `/api/prometheus-metrics` | GET | Prometheus-formatted metrics |

## Dashboard Features

### Cluster Overview
CPU cores, total/used memory, swap usage, memory bar.

### Node Cards
Architecture, CPU cores, memory bar — expand for OS, uptime, CPU model, temp, load, kernel, processes, swap, block devices.

### Graph/Log Overlays (bottom nav)
- **Charts**: Memory, CPU %, Temp, Load, Network RX/TX, Disk I/O Read/Write, Swap, Per-Node Memory
- **Logs**: Watchdog, Pi-hole, NFS, Prometheus, Grafana, WireGuard status
- Auto-refresh: status every 5s, logs every 30s
- Persistent history: 500 points per metric via localStorage

### Settings Panel (gear icon in header)
- **Dashboard**: poll interval, history retention
- **Watchdog**: enable/disable, check interval, RAM threshold, node selection
- **Pi-hole DNS**: upstream DNS 1 & 2
- **NFS Exports**: add/remove export paths with network ACLs
- **Prometheus**: scrape interval, scrape targets
- **WireGuard Peers**: add/remove peers
- **Node SSH**: host, user, sudo password per node

Save writes to settings.json; Apply pushes config to remote services (restarts Prometheus, NFS, WireGuard, regenerates watchdog, updates Pi-hole DNS).

## Services

### Pi4 (10.42.0.141)
- **NFS**: `/mnt/storage/{backup,crossbuild}` exported to both subnets
- **Prometheus**: scrapes all 4 nodes on port 9100 + dashboard metrics endpoint
- **Grafana**: Prometheus datasource configured, admin/admin
- **WireGuard**: wg0 on 10.0.0.1/24, port 51820
- **Storage**: 128GB USB at `/mnt/storage`

### Pi2 (10.42.1.109)
- **Pi-hole**: DNS filtering, upstream 1.1.1.1/8.8.8.8

### LicheeRV (192.168.254.25)
- Buildroot with limited Busybox tools
- 109GB rootfs, 8GB swap partition
