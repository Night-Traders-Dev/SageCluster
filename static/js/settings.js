let currentSettings = {};

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}

async function openSettings() {
    document.getElementById('settings-panel').classList.add('open');
    document.getElementById('settings-content').innerHTML = '<div class="text-center text-slate-500 py-8"><span class="spinner"></span> Loading...</div>';
    try {
        const r = await fetch('/api/settings');
        currentSettings = await r.json();
        renderSettings();
    } catch (e) {
        document.getElementById('settings-content').innerHTML = '<div class="text-red-400 text-center py-8">Failed to load settings.</div>';
    }
}

function closeSettings() {
    document.getElementById('settings-panel').classList.remove('open');
}

function renderSettings() {
    const s = currentSettings;
    if (!s) return;
    let html = '';

    // Dashboard
    html += '<div class="setting-section"><h4><i class="ph ph-gauge text-emerald-400"></i> Dashboard</h4>';
    html += `<div class="grid grid-cols-2 gap-4">
        <div><label>Poll Interval (s)</label><input type="number" id="s-dash-poll" value="${s.dashboard?.poll_interval || 5}" min="1" max="60"></div>
        <div><label>History Points</label><input type="number" id="s-dash-history" value="${s.dashboard?.history_points || 500}" min="50" max="5000"></div>
    </div></div>`;

    // Watchdog
    const wd = s.watchdog || {};
    html += '<div class="setting-section"><h4><i class="ph ph-shield-check text-sky-400"></i> Watchdog</h4>';
    html += `<div class="flex items-center gap-3 mb-3"><label style="margin:0">Enabled</label><input type="checkbox" id="s-wd-enabled" ${wd.enabled ? 'checked' : ''} style="width:auto"></div>`;
    html += `<div class="grid grid-cols-2 gap-4">
        <div><label>Check Interval (s)</label><input type="number" id="s-wd-interval" value="${wd.check_interval || 60}" min="10" max="600"></div>
        <div><label>RAM Threshold (%)</label><input type="number" id="s-wd-threshold" value="${wd.ram_threshold || 20}" min="5" max="90"></div>
    </div>`;
    const allNodes = ['orangepi', 'pi4', 'pi2', 'licheerv'];
    html += '<div><label>Monitored Nodes</label><div class="flex flex-wrap gap-2 mt-1">';
    for (const nid of allNodes) {
        const checked = (wd.nodes || []).includes(nid);
        html += `<label class="flex items-center gap-1 text-sm text-slate-300 cursor-pointer" style="width:auto;text-transform:none">
            <input type="checkbox" class="s-wd-node" value="${nid}" ${checked ? 'checked' : ''} style="width:auto"> ${nid}
        </label>`;
    }
    html += '</div></div></div>';

    // Pi-hole
    html += '<div class="setting-section"><h4><i class="ph ph-eye-slash text-amber-400"></i> Pi-hole DNS</h4>';
    html += `<div class="grid grid-cols-2 gap-4">
        <div><label>Upstream DNS 1</label><input type="text" id="s-ph-dns1" value="${s.pihole?.upstream_dns_1 || '1.1.1.1'}"></div>
        <div><label>Upstream DNS 2</label><input type="text" id="s-ph-dns2" value="${s.pihole?.upstream_dns_2 || '8.8.8.8'}"></div>
    </div></div>`;

    // NFS
    html += '<div class="setting-section"><h4><i class="ph ph-folder text-emerald-400"></i> NFS Exports</h4>';
    const exports = s.nfs?.exports || [];
    for (let i = 0; i < exports.length; i++) {
        const exp = exports[i];
        html += `<div class="nfs-entry mb-3 p-3 bg-slate-900 rounded-lg" data-idx="${i}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-400 uppercase tracking-wider">Export #${i+1}</span>
                <button onclick="removeNfsExport(${i})" class="text-red-400 text-xs hover:text-red-300 p-1 rounded hover:bg-slate-700">Remove</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label>Path</label><input type="text" class="s-nfs-path" value="${exp.path}" placeholder="/mnt/storage/..."></div>
                <div><label>Networks (space-sep)</label><input type="text" class="s-nfs-nets" value="${(exp.networks || []).join(' ')}" placeholder="10.0.0.0/24"></div>
            </div>
        </div>`;
    }
    html += `<button onclick="addNfsExport()" class="btn btn-sm" style="background:#334155;color:#94a3b8;margin-top:4px"><i class="ph ph-plus"></i> Add Export</button></div>`;

    // Prometheus
    html += '<div class="setting-section"><h4><i class="ph ph-chart-bar text-red-400"></i> Prometheus</h4>';
    html += `<div class="mb-3"><label>Scrape Interval (s)</label><input type="number" id="s-prom-interval" value="${s.prometheus?.scrape_interval || 15}" min="5" max="300"></div>`;
    const targets = s.prometheus?.scrape_targets || [];
    html += '<div><label>Scrape Targets</label><div id="prom-targets-list" class="flex flex-wrap gap-1 mt-1">';
    for (const t of targets) {
        html += `<span class="tag">${t} <span class="remove" onclick="removePromTarget('${t}')">&times;</span></span>`;
    }
    html += '</div><div class="flex gap-2 mt-2"><input type="text" id="s-prom-new-target" placeholder="host:port" style="flex:1"><button onclick="addPromTarget()" class="btn btn-sm" style="background:#334155;color:#94a3b8">Add</button></div></div></div>';

    // WireGuard
    html += '<div class="setting-section"><h4><i class="ph ph-shield text-blue-400"></i> WireGuard Peers</h4>';
    const peers = s.wireguard?.peers || [];
    for (let i = 0; i < peers.length; i++) {
        const p = peers[i];
        html += `<div class="wg-entry mb-3 p-3 bg-slate-900 rounded-lg" data-idx="${i}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-400 uppercase tracking-wider">Peer #${i+1}</span>
                <button onclick="removeWgPeer(${i})" class="text-red-400 text-xs hover:text-red-300 p-1 rounded hover:bg-slate-700">Remove</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div><label>Public Key</label><input type="text" class="s-wg-pub" value="${p.public_key || ''}" style="font-size:11px"></div>
                <div><label>Allowed IPs</label><input type="text" class="s-wg-ips" value="${p.allowed_ips || ''}" placeholder="10.0.0.2/32"></div>
            </div>
        </div>`;
    }
    html += `<button onclick="addWgPeer()" class="btn btn-sm" style="background:#334155;color:#94a3b8;margin-top:4px"><i class="ph ph-plus"></i> Add Peer</button></div>`;

    // Nodes
    html += '<div class="setting-section"><h4><i class="ph ph-hard-drives text-indigo-400"></i> Node SSH Settings</h4>';
    const nodeKeys = ['orangepi', 'pi4', 'pi2', 'licheerv'];
    for (const nid of nodeKeys) {
        const ns = s.nodes?.[nid] || {};
        html += `<details class="mb-3"><summary class="text-sm font-medium text-slate-300 cursor-pointer hover:text-white capitalize">${nid}</summary>
        <div class="grid grid-cols-3 gap-3 mt-2 p-3 bg-slate-900 rounded-lg">
            <div><label>Host</label><input type="text" class="s-node-host" data-node="${nid}" value="${ns.host || ''}"></div>
            <div><label>User</label><input type="text" class="s-node-user" data-node="${nid}" value="${ns.user || ''}"></div>
            <div><label>sudo Password</label><input type="password" class="s-node-pwd" data-node="${nid}" value="${ns.sudo_password || ''}"></div>
        </div></details>`;
    }
    html += '</div>';

    document.getElementById('settings-content').innerHTML = html;
}

function collectSettings() {
    const s = JSON.parse(JSON.stringify(currentSettings));

    s.dashboard = s.dashboard || {};
    s.dashboard.poll_interval = parseInt(document.getElementById('s-dash-poll')?.value) || 5;
    s.dashboard.history_points = parseInt(document.getElementById('s-dash-history')?.value) || 500;

    s.watchdog = s.watchdog || {};
    s.watchdog.enabled = document.getElementById('s-wd-enabled')?.checked || false;
    s.watchdog.check_interval = parseInt(document.getElementById('s-wd-interval')?.value) || 60;
    s.watchdog.ram_threshold = parseInt(document.getElementById('s-wd-threshold')?.value) || 20;
    s.watchdog.nodes = [];
    document.querySelectorAll('.s-wd-node:checked').forEach(cb => s.watchdog.nodes.push(cb.value));

    s.pihole = s.pihole || {};
    s.pihole.upstream_dns_1 = document.getElementById('s-ph-dns1')?.value || '1.1.1.1';
    s.pihole.upstream_dns_2 = document.getElementById('s-ph-dns2')?.value || '8.8.8.8';

    s.nfs = s.nfs || { exports: [] };
    s.nfs.exports = [];
    document.querySelectorAll('.nfs-entry').forEach(el => {
        const path = el.querySelector('.s-nfs-path')?.value?.trim();
        const nets = el.querySelector('.s-nfs-nets')?.value?.trim().split(/\s+/) || [];
        if (path) s.nfs.exports.push({ path, networks: nets.filter(Boolean) });
    });

    s.prometheus = s.prometheus || {};
    s.prometheus.scrape_interval = parseInt(document.getElementById('s-prom-interval')?.value) || 15;
    s.prometheus.scrape_targets = [];
    document.querySelectorAll('#prom-targets-list .tag').forEach(tag => {
        const txt = tag.textContent.replace('\u00d7', '').trim();
        if (txt) s.prometheus.scrape_targets.push(txt);
    });

    s.wireguard = s.wireguard || { peers: [] };
    s.wireguard.peers = [];
    document.querySelectorAll('.wg-entry').forEach(el => {
        const pub = el.querySelector('.s-wg-pub')?.value?.trim();
        const ips = el.querySelector('.s-wg-ips')?.value?.trim();
        if (pub && ips) s.wireguard.peers.push({ public_key: pub, allowed_ips: ips });
    });

    s.nodes = s.nodes || {};
    document.querySelectorAll('.s-node-host').forEach(inp => {
        const nid = inp.dataset.node;
        if (!s.nodes[nid]) s.nodes[nid] = {};
        s.nodes[nid].host = inp.value;
    });
    document.querySelectorAll('.s-node-user').forEach(inp => {
        const nid = inp.dataset.node;
        if (!s.nodes[nid]) s.nodes[nid] = {};
        s.nodes[nid].user = inp.value;
    });
    document.querySelectorAll('.s-node-pwd').forEach(inp => {
        const nid = inp.dataset.node;
        if (!s.nodes[nid]) s.nodes[nid] = {};
        s.nodes[nid].sudo_password = inp.value;
    });

    return s;
}

async function saveSettings() {
    const s = collectSettings();
    try {
        const r = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s),
        });
        const d = await r.json();
        if (d.status === 'saved') {
            currentSettings = s;
            toast('Settings saved.');
        } else {
            toast('Failed to save settings.');
        }
    } catch (e) {
        toast('Failed to save settings.');
    }
}

async function applySettings() {
    await saveSettings();
    const btn = document.querySelector('#settings-panel .btn-primary');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Applying...';
    try {
        const r = await fetch('/api/apply', { method: 'POST' });
        const d = await r.json();
        if (d.status === 'ok') {
            const parts = (d.results || []).map(r => `${r.component}: ${r.status}`).join(', ');
            toast('Applied: ' + parts);
        } else {
            toast('Apply failed.');
        }
    } catch (e) {
        toast('Apply request failed.');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Save Settings';
}

function addNfsExport() {
    const container = document.querySelector('.setting-section:has(.nfs-entry)') || document.querySelector('#settings-content');
    const last = container.querySelector('.nfs-entry:last-of-type');
    const idx = last ? parseInt(last.dataset.idx) + 1 : 0;
    const div = document.createElement('div');
    div.className = 'nfs-entry mb-3 p-3 bg-slate-900 rounded-lg';
    div.dataset.idx = idx;
    div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400 uppercase tracking-wider">Export #${idx + 1}</span>
            <button onclick="this.closest('.nfs-entry').remove()" class="text-red-400 text-xs hover:text-red-300 p-1 rounded hover:bg-slate-700">Remove</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label>Path</label><input type="text" class="s-nfs-path" placeholder="/mnt/storage/..."></div>
            <div><label>Networks (space-sep)</label><input type="text" class="s-nfs-nets" placeholder="10.0.0.0/24"></div>
        </div>`;
    if (last && last.parentNode) {
        last.parentNode.insertBefore(div, last.nextSibling);
    } else {
        document.querySelector('.setting-section:has(h4:has(.ph-folder))')?.appendChild(div);
    }
}

function removeNfsExport(idx) {
    document.querySelector(`.nfs-entry[data-idx="${idx}"]`)?.remove();
}

function addPromTarget() {
    const inp = document.getElementById('s-prom-new-target');
    const val = inp?.value?.trim();
    if (!val) return;
    const list = document.getElementById('prom-targets-list');
    if (list) {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = `${val} <span class="remove" onclick="this.parentElement.remove()">&times;</span>`;
        list.appendChild(span);
    }
    inp.value = '';
}

function removePromTarget(val) {
    document.querySelectorAll('#prom-targets-list .tag').forEach(tag => {
        if (tag.textContent.replace('\u00d7', '').trim() === val) tag.remove();
    });
}

function addWgPeer() {
    const container = document.querySelector('.setting-section:has(.wg-entry)');
    const last = container?.querySelector('.wg-entry:last-of-type');
    const idx = last ? parseInt(last.dataset.idx) + 1 : 0;
    const div = document.createElement('div');
    div.className = 'wg-entry mb-3 p-3 bg-slate-900 rounded-lg';
    div.dataset.idx = idx;
    div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-400 uppercase tracking-wider">Peer #${idx + 1}</span>
            <button onclick="this.closest('.wg-entry').remove()" class="text-red-400 text-xs hover:text-red-300 p-1 rounded hover:bg-slate-700">Remove</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div><label>Public Key</label><input type="text" class="s-wg-pub" placeholder="Base64 key" style="font-size:11px"></div>
            <div><label>Allowed IPs</label><input type="text" class="s-wg-ips" placeholder="10.0.0.2/32"></div>
        </div>`;
    if (last && last.parentNode) {
        last.parentNode.insertBefore(div, last.nextSibling);
    } else {
        container?.querySelector('button:last-of-type')?.before(div);
    }
}

function removeWgPeer(idx) {
    document.querySelector(`.wg-entry[data-idx="${idx}"]`)?.remove();
}

// Keyboard shortcut to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettings();
        closeOverlay();
    }
});
