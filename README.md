# SageCluster

A real-time cluster dashboard and management system for a heterogeneous 4‑node cluster — OrangePi, Raspberry Pi 4, Raspberry Pi 2, and LicheeRV Nano — with live graphs, persistent history, service logs, a web file manager, and centralized settings with remote apply.

![Dashboard](https://img.shields.io/badge/status-active-success)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11+-blue)

## Quick Start

```bash
cd ~/SageCluster
pip install fastapi uvicorn python-multipart
python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Open `http://<orange-pi-ip>:8080`

## Services Overview

| Service | Node | Port | Docs |
|---------|------|------|------|
| Dashboard (FastAPI) | OrangePi | 8080 | [docs/architecture.md](docs/architecture.md) |
| Web File Manager | OrangePi | 8080/files | [docs/api.md](docs/api.md) |
| Pi‑hole DNS | Pi2 | 53 / 80 (admin) | [docs/services.md](docs/services.md) |
| Prometheus | Pi4 | 9090 | [docs/services.md](docs/services.md) |
| Grafana | Pi4 | 3000 | [docs/services.md](docs/services.md) |
| NFS Server | Pi4 | 2049 | [docs/services.md](docs/services.md) |
| WireGuard VPN | Pi4 | 51820 | [docs/services.md](docs/services.md) |
| Cross‑compiler | Pi4 | — | [docs/services.md](docs/services.md) |
| Cloudflare Tunnel | OrangePi | ephemeral | [docs/services.md](docs/services.md) |
| Tailscale Funnel | OrangePi | https://...ts.net | [docs/services.md](docs/services.md) |
| Watchdog | OrangePi | — | [docs/services.md](docs/services.md) |
| DNS forwarder (dnsmasq) | OrangePi | 53 | [docs/services.md](docs/services.md) |

## Architecture

```
Four SBCs, three subnets, one dashboard.

OrangePi (riscv64, Ubuntu 24.04) ── dashboard + tunnels + watchdog + dnsmasq
├── Pi4 (arm64, Ubuntu 26.04) ── NFS + Prometheus + Grafana + WireGuard + cross-compiler
├── Pi2 (armv7l, Raspbian 13) ── Pi-hole DNS
└── LicheeRV (riscv64, Buildroot) ── low-power edge node
```

→ See [docs/architecture.md](docs/architecture.md) for network layout, subnets, and data flow.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Cluster + per‑node + tunnel status |
| `/api/logs/{component}` | GET | Logs for 8 components |
| `/api/settings` | GET/PUT | Read/write settings.json |
| `/api/apply` | POST | Push config to remote services |
| `/api/prometheus-metrics` | GET | Prometheus‑formatted metrics |
| `/api/files/login` | POST | File manager authentication |
| `/api/files/list` | POST | List directory contents |
| `/api/files/mkdir` | POST | Create directory |
| `/api/files/rename` | POST | Rename file or folder |
| `/api/files/delete` | POST | Delete files or folders |
| `/api/files/upload` | POST | Upload files (multipart) |
| `/api/files/download` | GET | Download a file |
| `/api/files/compress` | POST | Create tar.gz/tar.xz/zip |
| `/api/files/extract` | POST | Extract archive |

→ See [docs/api.md](docs/api.md) for full API reference.

## Dashboard Features

- **Cluster Overview** — CPU cores, memory, swap, aggregated across all nodes
- **Node Cards** — Architecture, CPU, memory bar with expandable details (OS, uptime, temp, load, kernel, processes, block devices)
- **Tunnel Cards** — Live Cloudflare and Tailscale Funnel URLs with status and traffic sparkline
- **10 Chart Metrics** — Memory, CPU %, Temperature, Load, Network RX/TX, Disk Read/Write, Swap, Per‑Node Memory
- **8 Log Sources** — Watchdog, Pi‑hole, NFS, Prometheus, Grafana, WireGuard, Cloudflare, Tailscale Funnel
- **Settings Panel** — Dashboard, watchdog, Pi‑hole DNS, NFS exports, Prometheus scrape targets, WireGuard peers, node SSH config
- **File Manager** — Browse, upload, download, create, rename, delete, compress, extract at `/files`

## Project Structure

```
SageCluster/
├── main.py               # FastAPI app — all API endpoints
├── config.py             # Node IP/user definitions
├── collector.py          # Parallel SSH stats collection
├── collect_stats.sh      # Shell script run on each node
├── file_manager.py       # File management API
├── settings.json         # Persisted configuration
├── watchdog.sh           # Cluster watchdog daemon
├── templates/
│   ├── index.html        # Dashboard HTML
│   └── files.html        # File manager HTML
├── static/js/
│   ├── app.js            # Main polling, DOM updates, tunnel charts
│   ├── charts.js         # Chart.js definitions & overlay management
│   ├── nodes.js          # Node card rendering & accordion toggle
│   ├── history.js        # localStorage persistence (500 pts/metric)
│   ├── settings.js       # Settings panel UI
│   └── files.js          # File manager UI
├── docs/
│   ├── architecture.md   # Network layout, subnets, data flow
│   ├── services.md       # All services described
│   ├── api.md            # Full API reference
│   └── deployment.md     # Install, run, update, file reference
└── README.md
```

## Public Access

Two tunnels expose the dashboard without opening firewall ports:

| Tunnel | URL | Persistent |
|--------|-----|------------|
| **Cloudflare** | `*.trycloudflare.com` (random) | No — URL changes on restart |
| **Tailscale Funnel** | `https://orangepirv2.tailcad549.ts.net` | Yes |

→ See [docs/services.md](docs/services.md) for tunnel details.
