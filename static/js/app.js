let nodesRendered = false;
let fetching = false;
let prevNet = {};
let prevNetTx = {};
let prevDiskRead = {};
let prevDisk = {};
let prevTimestamp = 0;

function formatTime(unixTime) {
    return new Date(unixTime * 1000).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function fetchClusterStatus() {
    if (fetching) return;
    fetching = true;
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = 'inline-block';
    try {
        const r = await fetch('/api/status');
        if (!r.ok) throw Error('bad response');
        const d = await r.json();
        spinner.style.display = 'none';

        document.getElementById('last-updated').textContent = 'Last updated: ' + formatTime(d.timestamp);
        document.getElementById('last-updated').classList.remove('text-red-400');

        const totalMem = d.cluster.total_mem_mb;
        const usedMem = d.cluster.used_mem_mb;
        const memPct = totalMem > 0 ? usedMem / totalMem * 100 : 0;

        document.getElementById('cluster-cpu').textContent = d.cluster.total_cpu;
        document.getElementById('cluster-mem-total').textContent = totalMem.toLocaleString() + ' MB';
        document.getElementById('cluster-mem-used').textContent = usedMem.toLocaleString();
        const swapTotal = d.cluster.swap_total_mb || 0;
        const swapUsed = d.cluster.swap_used_mb || 0;
        document.getElementById('cluster-swap').textContent = swapTotal ? swapUsed + ' / ' + swapTotal + ' MB' : '0 MB';

        const memBar = document.getElementById('cluster-mem-bar');
        memBar.style.width = memPct + '%';
        memBar.className = (memPct > 90 ? 'bg-red-500' : memPct > 75 ? 'bg-amber-500' : 'bg-emerald-500') + ' h-1.5 rounded-full data-transition';

        pushHistory('memory', usedMem);
        pushHistory('swap', d.cluster.swap_used_mb || 0);

        const now = Date.now();
        const dt = prevTimestamp ? (now - prevTimestamp) / 1000 : 5;
        prevTimestamp = now;

        for (const [id, nd] of Object.entries(d.nodes)) {
            if (!nd.cpus) continue;
            pushHistory('temp', Math.round(parseInt(nd.cpu_temp || 0) / 1000 * 10) / 10, id);
            pushHistory('load', parseFloat(nd.load?.split(' ')[0]) || 0, id);
            const netRx = parseInt(nd.net?.split(' ')[0]) || 0;
            const netTx = parseInt(nd.net?.split(' ')[1]) || 0;
            if (prevNet[id] !== undefined && dt > 0) pushHistory('network', Math.round(Math.max(0, netRx - prevNet[id]) / dt), id);
            if (prevNetTx[id] !== undefined && dt > 0) pushHistory('network_tx', Math.round(Math.max(0, netTx - prevNetTx[id]) / dt), id);
            prevNet[id] = netRx;
            prevNetTx[id] = netTx;
            const diskWr = parseInt(nd.disk_io?.split(' ')[1]) || 0;
            const diskRd = parseInt(nd.disk_io?.split(' ')[0]) || 0;
            if (prevDisk[id] !== undefined && dt > 0) pushHistory('disk', Math.round(Math.max(0, diskWr - prevDisk[id]) / dt), id);
            if (prevDiskRead[id] !== undefined && dt > 0) pushHistory('disk_read', Math.round(Math.max(0, diskRd - prevDiskRead[id]) / dt), id);
            prevDisk[id] = diskWr;
            prevDiskRead[id] = diskRd;
            const nm = parseMem(nd.mem);
            pushHistory('per_node_mem', nm.used, id);
            if (nd.cpu_usage) pushHistory('cpu', parseFloat(nd.cpu_usage), id);
        }
        saveHistory();

        if (chart && document.getElementById('graph-overlay').classList.contains('open')) updateChart();

        const container = document.getElementById('nodes-container');
        if (!nodesRendered) {
            const html = [];
            for (const [id, nd] of Object.entries(d.nodes)) html.push(createNodeCardHTML(id, nd));
            container.innerHTML = html.join('');
            nodesRendered = true;
            if (expandedNode) setExpandedSilent(expandedNode);
        } else {
            for (const [id, nd] of Object.entries(d.nodes)) updateNodeCard(id, nd);
        }

        const tunnels = d.tunnels;
        if (tunnels) updateTunnels(tunnels);
    } catch (e) {
        console.error('fetch error:', e);
        document.getElementById('last-updated').textContent = 'Connection lost. Retrying...';
        document.getElementById('last-updated').classList.add('text-red-400');
        document.getElementById('loading-spinner').style.display = 'none';
    } finally {
        fetching = false;
    }
}

let cfReqHistory = [];

function updateTunnels(t) {
    const cf = t.cloudflare;
    const fn = t.funnel;
    const cfDot = document.getElementById('cf-status-dot');
    const cfUrl = document.getElementById('cf-url');
    const cfReqs = document.getElementById('cf-requests');
    const cfConns = document.getElementById('cf-connections');
    if (cf) {
        const on = cf.status === 'connected';
        cfDot.className = 'w-2.5 h-2.5 rounded-full ' + (on ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500');
        cfUrl.textContent = cf.url || 'Not connected';
        cfUrl.href = cf.url || '#';
        cfReqs.textContent = cf.total_requests.toLocaleString();
        cfConns.textContent = cf.connections;
        cfReqHistory.push(cf.total_requests);
        if (cfReqHistory.length > 100) cfReqHistory.shift();
        drawCfTraffic();
    }
    const fnDot = document.getElementById('funnel-status-dot');
    const fnUrl = document.getElementById('funnel-url');
    const fnText = document.getElementById('funnel-status-text');
    if (fn) {
        const on = fn.status === 'active';
        fnDot.className = 'w-2.5 h-2.5 rounded-full ' + (on ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500');
        fnUrl.textContent = fn.url || 'Not active';
        fnUrl.href = fn.url || '#';
        fnText.innerHTML = 'Status: <span class="text-slate-200 font-mono">' + fn.status + '</span>';
    }
}

function drawCfTraffic() {
    const canvas = document.getElementById('cf-traffic-chart');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 300;
    canvas.height = rect.height || 48;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (cfReqHistory.length < 2) {
        ctx.fillStyle = '#475569';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Collecting data...', w/2, h/2 + 4);
        return;
    }
    const min = Math.min(...cfReqHistory);
    const max = Math.max(...cfReqHistory);
    const range = Math.max(max - min, 1);
    const pad = 4;
    const step = (w - pad * 2) / Math.max(cfReqHistory.length - 1, 1);
    ctx.beginPath();
    for (let i = 0; i < cfReqHistory.length; i++) {
        const x = pad + i * step;
        const y = h - pad - ((cfReqHistory[i] - min) / range) * (h - pad * 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(16,185,129,0.1)';
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(min.toLocaleString(), pad, h - 2);
    ctx.textAlign = 'right';
    ctx.fillText(max.toLocaleString(), w - pad, h - 2);
}

let activeMenu = null;

function toggleMenu(name) {
    const panel = document.getElementById('menu-' + name + '-panel');
    const btn = document.getElementById('menu-' + name);
    if (!panel || !btn) return;
    if (activeMenu === name) {
        panel.classList.remove('open');
        btn.classList.remove('active');
        activeMenu = null;
        return;
    }
    document.querySelectorAll('.nav-menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    panel.classList.add('open');
    btn.classList.add('active');
    activeMenu = name;
}

document.addEventListener('click', (e) => {
    if (activeMenu && !e.target.closest('.nav-menu') && !e.target.closest('.nav-btn')) {
        document.querySelectorAll('.nav-menu').forEach(m => m.classList.remove('open'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        activeMenu = null;
    }
});

function init() {
    document.querySelectorAll('.nav-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            openOverlay(btn.dataset.metric);
            document.querySelectorAll('.nav-menu').forEach(m => m.classList.remove('open'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            activeMenu = null;
        });
    });
    document.getElementById('mem-card').addEventListener('click', () => openOverlay('memory'));
    document.getElementById('graph-overlay').addEventListener('click', closeOverlay);
    fetchClusterStatus();
    setInterval(fetchClusterStatus, 5000);
    setInterval(() => {
        if (LOG_METRICS[currentMetric]) fetchLog(currentMetric);
    }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
