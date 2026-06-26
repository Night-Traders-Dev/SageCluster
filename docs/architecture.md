# Architecture

## Overview

SageCluster is a heterogeneous cluster of four single-board computers running different operating systems, connected across three subnets. The OrangePi serves as the central management node, running the dashboard web application and orchestrating monitoring, logging, and configuration for all other nodes.

## Network Layout

```
Internet
   │
   ├── Cloudflare Tunnel (trycloudflare.com)
   │   └── OrangePi (192.168.254.44) ── dnsmasq ──┬── Pi-hole (10.42.1.109)
   │   └── Tailscale Funnel (ts.net)               │
   │                                                ├── Pi4 (10.42.0.141) ── WireGuard (10.0.0.1/24)
   │                                                └── LicheeRV (192.168.254.25)
   │
   └── Home WiFi Router (192.168.254.0/24)
```

| Node | IP (subnet) | OS | Role |
|------|-------------|-----|------|
| **OrangePi** | 192.168.254.44 (WiFi), 10.42.0.1 (Pi4 VLAN), 10.42.1.1 (Pi2 VLAN) | Ubuntu 24.04 riscv64 | Dashboard, DNS forwarder, watchdog, tunnels |
| **Pi4** | 10.42.0.141, 10.0.0.1 (WireGuard) | Ubuntu 26.04 arm64 | NFS, Prometheus, Grafana, storage, cross-compiler, WireGuard |
| **Pi2** | 10.42.1.109 | Raspbian 13 armv7l | Pi-hole DNS filter |
| **LicheeRV** | 192.168.254.25 | Buildroot 2025.02 riscv64 | Low-power edge node |

## Subnets

| Subnet | Purpose |
|--------|---------|
| `192.168.254.0/24` | WiFi LAN — OrangePi WiFi, LicheeRV, dashboard clients |
| `10.42.0.0/24` | Pi4 VLAN — OrangePi (end1) ↔ Pi4 (enx...) |
| `10.42.1.0/24` | Pi2 VLAN — OrangePi (end0) ↔ Pi2 |
| `10.0.0.0/24` | WireGuard tunnel subnet on Pi4 |

## Data Flow

1. **Dashboard polls** every 5 seconds — `main.py` uses `ThreadPoolExecutor` to SSH into all 4 nodes in parallel, runs `collect_stats.sh`, and aggregates the results.
2. **DNS queries** from WiFi clients and LicheeRV → OrangePi's `dnsmasq` (port 53) → Pi‑hole (10.42.1.109) → upstream (1.1.1.1/8.8.8.8).
3. **Metrics** scraped by Prometheus on Pi4 from all node exporters (port 9100) + dashboard Prometheus endpoint.
4. **Tunnels** provide public access: Cloudflare (ephemeral trycloudflare) and Tailscale Funnel (persistent ts.net) both point to `localhost:8080` on OrangePi.
