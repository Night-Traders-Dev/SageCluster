# API Reference

Base URL: `http://<host>:8080` (or any tunnel URL)

## Dashboard

### `GET /` — Dashboard HTML page

### `GET /files` — File Manager HTML page

---

## Status

### `GET /api/status`

Returns cluster overview, per‑node stats, and tunnel status. Polled every 5 s by the dashboard.

```json
{
  "cluster": {
    "total_cpu": 12,
    "total_mem_mb": 8192,
    "used_mem_mb": 3200,
    "swap_total_mb": 16384,
    "swap_used_mb": 512
  },
  "nodes": {
    "orangepi": { "status": "online", "arch": "riscv64", "cpus": "4", "mem": "8192,3200", ... },
    "pi4": { ... },
    "pi2": { ... },
    "licheerv": { ... }
  },
  "tunnels": {
    "cloudflare": { "status": "connected", "url": "https://...trycloudflare.com", "total_requests": 42, "connections": 1 },
    "funnel": { "status": "active", "url": "https://orangepirv2.tailcad549.ts.net" }
  },
  "timestamp": 1712345678.0
}
```

---

## Logs

### `GET /api/logs/{component}`

Returns the last 100 lines of log for the given component.

| Component | Source |
|-----------|--------|
| `watchdog` | `/tmp/watchdog.log` (local) |
| `pihole` | Pi‑hole query log on Pi2 |
| `nfs` | NFS server journal on Pi4 |
| `prometheus` | Prometheus journal on Pi4 |
| `grafana` | Grafana journal on Pi4 |
| `wireguard` | `wg show` + systemd status on Pi4 |
| `cloudflared` | `cloudflared-tunnel` journal (local) |
| `funnel` | `tailscale serve status` + `tailscale status` (local) |

---

## Settings

### `GET /api/settings`

Returns the full `settings.json`.

### `PUT /api/settings`

Update settings. Body is the full settings JSON. Saves to `settings.json`.

### `POST /api/apply`

Reads current settings and pushes configuration to remote services:
- Restarts Prometheus on Pi4 with updated scrape config
- Applies NFS exports on Pi4
- Restarts WireGuard on Pi4 with updated peers
- Updates Pi‑hole DNS and restarts DNS
- Regenerates and restarts watchdog daemon

---

## Metrics

### `GET /api/prometheus-metrics`

Prometheus‑formatted text metrics for dashboard scraping.

```
# HELP sagecluster_up Node reachable
# TYPE sagecluster_up gauge
sagecluster_up{node="orangepi"} 1
sagecluster_up{node="pi4"} 1
sagecluster_up{node="pi2"} 1
sagecluster_up{node="licheerv"} 1
# HELP sagecluster_timestamp Timestamp
# TYPE sagecluster_timestamp gauge
sagecluster_timestamp 1712345678.0
```

---

## File Manager

All endpoints require a `token` field obtained from `/api/files/login`.

### `POST /api/files/login`

```json
// Request:  { "password": "sagecluster" }
// Response: { "token": "abc123...", "expires_in": 86400 }
```

### `POST /api/files/list`

```json
// Request:  { "token": "...", "path": "" }
// Response: { "path": "", "entries": [{ "name": "backup", "is_dir": true, "size": 0, "modified": 1712345678, "ext": "" }, ...] }
```

### `POST /api/files/mkdir`

```json
{ "token": "...", "path": "", "name": "new-folder" }
```

### `POST /api/files/rename`

```json
{ "token": "...", "path": "", "old_name": "old.txt", "new_name": "new.txt" }
```

### `POST /api/files/delete`

```json
{ "token": "...", "path": "", "names": ["file1.txt", "folder2"] }
```

### `POST /api/files/upload` (multipart)

| Field | Type |
|-------|------|
| `token` | string |
| `path` | string |
| `files` | file[] |

### `GET /api/files/download?path=...&file=...&token=...`

Downloads a single file.

### `POST /api/files/compress`

```json
{ "token": "...", "path": "", "names": ["file1", "folder2"], "format": "tar.gz", "archive_name": "backup.tar.gz" }
```

Formats: `tar.gz`, `tar.xz`, `zip`

### `POST /api/files/extract`

```json
{ "token": "...", "path": "", "archive": "backup.tar.gz" }
```

Supports: `.tar`, `.tar.gz`, `.tgz`, `.tar.xz`, `.zip`
