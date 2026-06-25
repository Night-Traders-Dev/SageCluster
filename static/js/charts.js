const METRICS = {
    memory: {
        label: 'Memory Usage', icon: 'ph-chart-line-up', color: '#10b981', unit: 'MB', yUnit: ' MB',
        getData: () => ({ labels: getHistoryLabels('memory'), values: [getHistoryValues('memory')] }),
        datasets: (d) => [{ label: 'Used Memory', data: d.values[0], borderColor: '#10b981', backgroundColor: '#10b98118', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 }],
    },
    cpu: {
        label: 'CPU Usage', icon: 'ph-cpu', color: '#3b82f6', unit: '%', yUnit: ' %',
        getData: () => ({ labels: getHistoryLabels('cpu'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('cpu', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n, data: d.values[i] || [], borderColor: ['#3b82f6', '#06b6d4', '#8b5cf6'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
    temp: {
        label: 'CPU Temperature', icon: 'ph-thermometer', color: '#ef4444', unit: '\u00b0C', yUnit: ' \u00b0C',
        getData: () => ({ labels: getHistoryLabels('temp'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('temp', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n, data: d.values[i] || [], borderColor: ['#ef4444', '#f97316', '#eab308'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
    load: {
        label: 'CPU Load Average', icon: 'ph-chart-bar', color: '#f59e0b', unit: 'load', yUnit: ' (load)',
        getData: () => ({ labels: getHistoryLabels('load'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('load', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n, data: d.values[i] || [], borderColor: ['#f59e0b', '#84cc16', '#06b6d4'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
    network: {
        label: 'Network I/O (RX)', icon: 'ph-wifi-high', color: '#8b5cf6', unit: 'bytes/s', yUnit: ' bytes/s',
        getData: () => ({ labels: getHistoryLabels('network'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('network', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n + ' RX', data: d.values[i] || [], borderColor: ['#8b5cf6', '#a78bfa', '#c4b5fd'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
    disk: {
        label: 'Disk I/O (Writes)', icon: 'ph-hard-drives', color: '#ec4899', unit: 'sectors/s', yUnit: ' sectors/s',
        getData: () => ({ labels: getHistoryLabels('disk'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('disk', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n, data: d.values[i] || [], borderColor: ['#ec4899', '#f472b6', '#f9a8d4'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
    swap: {
        label: 'Swap Usage', icon: 'ph-swap', color: '#14b8a6', unit: 'MB', yUnit: ' MB',
        getData: () => ({ labels: getHistoryLabels('swap'), values: [getHistoryValues('swap')] }),
        datasets: (d) => [{ label: 'Swap Used', data: d.values[0], borderColor: '#14b8a6', backgroundColor: '#14b8a618', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 }],
    },
    per_node_mem: {
        label: 'Per-Node Memory', icon: 'ph-memory', color: '#10b981', unit: 'MB', yUnit: ' MB',
        getData: () => ({ labels: getHistoryLabels('per_node_mem'), values: ['orangepi', 'pi4', 'pi2'].map(n => getHistoryValues('per_node_mem', n)) }),
        datasets: (d) => ['OrangePi', 'Pi4', 'Pi2'].map((n, i) => ({ label: n, data: d.values[i] || [], borderColor: ['#10b981', '#3b82f6', '#f59e0b'][i], backgroundColor: 'transparent', tension: 0.3, pointRadius: 2, borderWidth: 2 })),
    },
};

let chart = null;
let currentMetric = 'memory';

function openOverlay(metric) {
    currentMetric = metric;
    document.getElementById('graph-overlay').classList.add('open');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.metric === metric));
    requestAnimationFrame(() => {
        if (!chart) initChart();
        updateChart();
    });
}

function closeOverlay() {
    document.getElementById('graph-overlay').classList.remove('open');
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
