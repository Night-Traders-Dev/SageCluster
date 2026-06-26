const NODE_KEYS = ['orangepi', 'pi4', 'pi2', 'licheerv'];
const NODE_LABELS = ['OrangePi', 'Pi4', 'Pi2', 'LicheeRV'];
const NODE_CLRS = {
    cpu: ['#3b82f6', '#06b6d4', '#8b5cf6', '#f43f5e'],
    temp: ['#ef4444', '#f97316', '#eab308', '#a855f7'],
    load: ['#f59e0b', '#84cc16', '#06b6d4', '#ec4899'],
    network: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#f472b6'],
    disk: ['#ec4899', '#f472b6', '#f9a8d4', '#fb923c'],
    mem: ['#10b981', '#3b82f6', '#f59e0b', '#a855f7'],
};

function multiMetric(label, icon, color, unit, yUnit, key, clrs) {
    return {
        label, icon, color, unit, yUnit,
        getData: () => ({
            labels: getHistoryLabels(key),
            values: NODE_KEYS.map(n => getHistoryValues(key, n)),
        }),
        datasets: (d) => NODE_LABELS.map((n, i) => ({
            label: n,
            data: d.values[i] || [],
            borderColor: clrs[i],
            backgroundColor: 'transparent',
            tension: 0.3, pointRadius: 2, borderWidth: 2,
        })),
    };
}

const METRICS = {
    memory: {
        label: 'Memory Usage', icon: 'ph-chart-line-up', color: '#10b981', unit: 'MB', yUnit: ' MB',
        getData: () => ({ labels: getHistoryLabels('memory'), values: [getHistoryValues('memory')] }),
        datasets: (d) => [{ label: 'Used Memory', data: d.values[0], borderColor: '#10b981', backgroundColor: '#10b98118', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 }],
    },
    cpu: multiMetric('CPU Usage', 'ph-cpu', '#3b82f6', '%', ' %', 'cpu', NODE_CLRS.cpu),
    temp: multiMetric('CPU Temperature', 'ph-thermometer', '#ef4444', '\u00b0C', ' \u00b0C', 'temp', NODE_CLRS.temp),
    load: multiMetric('CPU Load Average', 'ph-chart-bar', '#f59e0b', 'load', ' (load)', 'load', NODE_CLRS.load),
    network: multiMetric('Network I/O (RX)', 'ph-wifi-high', '#8b5cf6', 'bytes/s', ' bytes/s', 'network', NODE_CLRS.network),
    network_tx: multiMetric('Network I/O (TX)', 'ph-wifi-high', '#f472b6', 'bytes/s', ' bytes/s', 'network_tx', ['#f472b6', '#ec4899', '#8b5cf6', '#a78bfa']),
    disk: multiMetric('Disk I/O (Writes)', 'ph-hard-drives', '#ec4899', 'sectors/s', ' sectors/s', 'disk', NODE_CLRS.disk),
    disk_read: multiMetric('Disk I/O (Reads)', 'ph-hard-drives', '#34d399', 'sectors/s', ' sectors/s', 'disk_read', ['#34d399', '#06b6d4', '#f59e0b', '#a855f7']),
    swap: {
        label: 'Swap Usage', icon: 'ph-swap', color: '#14b8a6', unit: 'MB', yUnit: ' MB',
        getData: () => ({ labels: getHistoryLabels('swap'), values: [getHistoryValues('swap')] }),
        datasets: (d) => [{ label: 'Swap Used', data: d.values[0], borderColor: '#14b8a6', backgroundColor: '#14b8a618', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 }],
    },
    per_node_mem: multiMetric('Per-Node Memory', 'ph-memory', '#10b981', 'MB', ' MB', 'per_node_mem', NODE_CLRS.mem),
};

let chart = null;
let currentMetric = 'memory';

const LOG_METRICS = {
    watchdog: { title: 'Watchdog Log', icon: 'ph-shield-check', color: '#38bdf8', api: '/api/logs/watchdog', refresh: 30000 },
    pihole: { title: 'Pi-hole Query Log', icon: 'ph-eye-slash', color: '#f59e0b', api: '/api/logs/pihole', refresh: 30000 },
    nfs: { title: 'NFS Server Log (Pi4)', icon: 'ph-folder', color: '#10b981', api: '/api/logs/nfs', refresh: 30000 },
    prometheus: { title: 'Prometheus Log (Pi4)', icon: 'ph-chart-bar', color: '#e74c3c', api: '/api/logs/prometheus', refresh: 30000 },
    grafana: { title: 'Grafana Log (Pi4)', icon: 'ph-graph', color: '#f39c12', api: '/api/logs/grafana', refresh: 30000 },
    wireguard: { title: 'WireGuard Status (Pi4)', icon: 'ph-shield', color: '#3498db', api: '/api/logs/wireguard', refresh: 30000 },
};

function openOverlay(metric) {
    currentMetric = metric;
    document.getElementById('graph-overlay').classList.add('open');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.metric === metric));

    const chartArea = document.getElementById('chart-area');
    const logArea = document.getElementById('log-area');

    if (LOG_METRICS[metric]) {
        const cfg = LOG_METRICS[metric];
        chartArea.style.display = 'none';
        logArea.style.display = 'block';
        document.getElementById('overlay-title').textContent = cfg.title;
        document.getElementById('overlay-icon').className = 'ph ' + cfg.icon;
        document.getElementById('overlay-icon').style.color = cfg.color;
        document.getElementById('overlay-unit').textContent = 'Last 100 lines — auto-refreshes';
        fetchLog(metric);
    } else {
        chartArea.style.display = 'block';
        logArea.style.display = 'none';
        requestAnimationFrame(() => {
            if (!chart) initChart();
            updateChart();
        });
    }
}

function closeOverlay() {
    document.getElementById('graph-overlay').classList.remove('open');
}

async function fetchLog(metric) {
    const cfg = LOG_METRICS[metric];
    if (!cfg) return;
    try {
        const r = await fetch(cfg.api);
        const d = await r.json();
        document.getElementById('log-content').textContent = d.log || 'No entries yet.';
    } catch (e) {
        document.getElementById('log-content').textContent = 'Failed to fetch ' + cfg.title;
    }
}

function initChart() {
    chart = new Chart(document.getElementById('main-chart').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 10 } }, grid: { color: 'rgba(100,116,139,0.15)' } },
                y: { beginAtZero: true, ticks: { color: '#64748b', font: { size: 10 }, callback: v => v }, grid: { color: 'rgba(100,116,139,0.15)' } },
            },
        },
    });
}

function updateChart() {
    const m = METRICS[currentMetric];
    if (!m || !chart) return;
    const d = m.getData();
    document.getElementById('overlay-title').textContent = m.label + ' Over Time';
    const iconEl = document.getElementById('overlay-icon');
    iconEl.className = 'ph ' + m.icon;
    iconEl.style.color = m.color;
    document.getElementById('overlay-unit').textContent = 'All values in ' + m.unit;
    chart.data.labels = d.labels;
    chart.data.datasets = m.datasets(d);
    chart.options.scales.y.ticks.callback = v => v + m.yUnit;
    chart.update('none');
}
