# SageCluster

A real-time cluster dashboard for monitoring multiple Linux nodes (OrangePi RV2, Raspberry Pi 4, Raspberry Pi 2) with live graphs, persistent history, and expandable node details.

## Structure

```
SageCluster/
├── main.py              # FastAPI app entry point (uvicorn main:app)
├── config.py            # Node IP/user configuration
├── collector.py         # Parallel SSH stats collection
├── collect_stats.sh     # Shell script run on each node
├── templates/
│   └── index.html       # Dashboard HTML template
├── static/js/
│   ├── history.js       # localStorage persistence (500 pts/metric)
│   ├── nodes.js         # Node card rendering & accordion toggle
│   ├── charts.js        # Chart.js definitions & overlay management
│   └── app.js           # Main polling, DOM updates, init
└── README.md
```

## Install

```bash
sudo apt install python3-pip
pip install fastapi uvicorn jinja2
```

## Run

```bash
cd SageCluster
uvicorn main:app --host 0.0.0.0 --port 8080
```

Open `http://<ORANGEPI_IP>:8080`

## Configuration

Edit `config.py` to set node hostnames/IPs and SSH usernames.

## Features

- **Cluster overview**: CPU cores, total/used memory, swap usage
- **Node cards**: Architecture, CPU cores, memory bar (always visible)
- **Click to expand**: OS, uptime, CPU model, temperature, load, kernel, processes, swap, storage
- **Bottom nav bar**: 8 real-time graph overlays (Memory, CPU %, Temp, Load, Network, Disk I/O, Swap, Per-Node Memory)
- **Persistent history**: Data survives page refresh via localStorage
- **Parallel collection**: SSH to all nodes runs concurrently
- **Rate tracking**: Network and disk I/O shown as bytes/s and sectors/s (not cumulative)
- **CPU temp**: Properly converted from millidegrees
