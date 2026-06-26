# Services

## Dashboard (OrangePi — port 8080)

**What**: Real-time cluster monitoring web app built with FastAPI + Chart.js + Tailwind CSS.

**Why**: Centralized view of all 4 nodes with live graphs, persistent history (500 pts/metric via localStorage), log viewers, and a settings panel that pushes configuration changes to remote services (Prometheus, NFS, WireGuard, Pi‑hole, Watchdog).

**Tech**: Python FastAPI + Uvicorn, Jinja2 templating, vanilla JS (no framework).

---

## Pi‑hole (Pi2)

**What**: DNS-level ad blocker and privacy tool. Web admin at `http://10.42.1.109/admin` (password: `admin`). Upstream DNS set to 1.1.1.1 / 8.8.8.8.

**Why**: Blocks tracking domains and ads network-wide before they reach any device. All WiFi clients and LicheeRV route DNS through OrangePi → Pi‑hole.

---

## NFS Server (Pi4)

**What**: Network File System exports serving `/mnt/storage/backup` and `/mnt/storage/crossbuild` to both subnets (rw, sync, no_subtree_check).

**Why**: Centralized shared storage for backup data and cross-compilation artifacts. Backed by a 128 GB SanDisk Ultra USB flash drive at `/mnt/storage` (113 GB usable, ext4). The file manager (see below) operates on these exports.

---

## Web File Manager (OrangePi — /files)

**What**: Google Drive‑style web file manager for the NFS storage. Password‑protected (default `sagecluster`), with 24‑hour auth tokens.

**Features**:
- Browse directories, create/rename/delete files and folders
- Upload via button or drag‑and‑drop
- Download single files
- Compress to `tar.gz`, `tar.xz`, or `zip`
- Extract `tar`, `tar.gz`, `tar.xz`, `zip`

**Why**: Provides a convenient web UI for managing backup files and cross‑build artifacts without needing to SSH or mount NFS locally.

---

## Prometheus (Pi4 — port 9090)

**What**: Metrics collection and alerting system. Scrapes every 15 s:
- `localhost:9090` — Prometheus itself
- `localhost:9100` — Pi4 node exporter
- `10.42.0.1:9100` — OrangePi node exporter
- `10.42.1.109:9100` — Pi2 node exporter
- `192.168.254.25:9100` — LicheeRV node exporter
- `192.168.254.44:8080/api/prometheus-metrics` — Dashboard metrics

**Why**: Long‑term metrics retention for cluster analysis, Grafana datasource.

---

## Grafana (Pi4 — port 3000)

**What**: Metrics visualization and dashboards. Pre‑configured with Prometheus datasource (admin/admin).

**Why**: Rich dashboards, alerting, and ad‑hoc querying on top of Prometheus data.

---

## WireGuard (Pi4 — port 51820)

**What**: Lightweight VPN tunnel. Interface `wg0` at `10.0.0.1/24`, public key `9WsWRFR/C1W7UiXdjHsnZffA9ZQclss/AtMLeKmTnRE=`.

**Why**: Secure remote access to the cluster network without exposing services to the internet. Can be used for off‑site monitoring and management.

---

## Cross‑Compiler (Pi4)

**What**: `gcc-riscv64-linux-gnu` toolchain installed on Pi4. Cross‑build output goes to `/mnt/storage/crossbuild`.

**Why**: Building RISC‑V binaries for OrangePi and LicheeRV is too slow on those devices; Pi4's arm64 cores are much faster.

---

## DNS Forwarder — dnsmasq (OrangePi)

**What**: Lightweight DNS forwarder listening on `192.168.254.44:53` and `127.0.0.1:53`. Forwards all queries to Pi‑hole (10.42.1.109).

**Why**: Bridges the two subnets — WiFi clients (192.168.254.x) and the Pi2 VLAN (10.42.1.x) are on different networks, but dnsmasq on OrangePi has access to both. LicheeRV also points DNS at OrangePi.

---

## Watchdog (OrangePi)

**What**: Bash daemon (`watchdog.sh`) checking all 4 nodes every 60 seconds. Pings each node, checks free RAM, and drops caches if free RAM falls below 20%.

**Why**: Prevents out‑of‑memory hangs on memory‑constrained nodes (especially LicheeRV with 512 MB RAM). Logs to `/tmp/watchdog.log`, viewable from the dashboard logs menu.

---

## Cluster Swap

**What**: Swap partitions sized to match RAM on each node:
- **OrangePi**: 8191 MB swap (8 GB RAM)
- **Pi4**: 4095 MB swap (4 GB RAM)
- **LicheeRV**: 8192 MB swap partition (p3, 512 MB RAM)

**Why**: Provides memory pressure relief and prevents OOM kills. LicheeRV's 8 GB swap is generous given its 512 MB RAM, but the SD card has 109 GB available and swap on an SD is faster than no swap.

---

## Cloudflare Tunnel (OrangePi)

**What**: Ephemeral tunnel using `cloudflared` to expose the dashboard at a random `*.trycloudflare.com` URL. Runs as a systemd service (`cloudflared-tunnel.service`), auto‑restarts.

**Why**: Zero‑config public access without opening firewall ports. The URL changes on each restart. (Built from Go source — cloudflared has no official riscv64 binary.)

---

## Tailscale Funnel (OrangePi)

**What**: Tailscale Funnel exposes the dashboard at `https://orangepirv2.tailcad549.ts.net`. Persists across restarts via `tailscale funnel --bg 8080`.

**Why**: Stable, permanent public URL that follows the device. Requires a Tailscale account and Funnel enabled in the admin console.
