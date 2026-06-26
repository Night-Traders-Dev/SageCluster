const NODE_ICONS = {
    orangepi: '<i class="fa-brands fa-linux text-xl text-yellow-500"></i>',
    pi4: '<i class="fa-brands fa-ubuntu text-xl text-[#E95420]"></i>',
    pi2: '<i class="fa-brands fa-raspberry-pi text-xl text-[#C51A4A]"></i>',
    licheerv: '<i class="fa-brands fa-linux text-xl text-sky-400"></i>',
};

function parseMem(s) {
    if (!s) return { total: 0, used: 0, percent: 0 };
    const p = s.split(',');
    const t = parseInt(p[0]) || 0;
    const u = parseInt(p[1]) || 0;
    return { total: t, used: u, percent: t > 0 ? Math.round(u / t * 100) : 0 };
}

function swapDisplay(s) {
    if (!s) return '0 MB';
    const p = s.split(',');
    const t = parseInt(p[0]) || 0;
    const u = parseInt(p[1]) || 0;
    return t > 0 ? u + ' / ' + t + ' MB' : '0 MB';
}

function blockDevicesHTML(data) {
    const devs = data.block_devices;
    if (!devs || devs.length === 0) {
        return data.storage
            ? `<div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Storage (/)</p><p class="text-sm text-slate-300 font-mono">${data.storage.used} / ${data.storage.size} MB (${data.storage.use_pct})</p></div>`
            : '';
    }
    return devs.map(d => `
        <div>
            <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">${d.device} (${d.mount})</p>
            <p class="text-sm text-slate-300 font-mono">${d.used} / ${d.size} MB (${d.use_pct})</p>
        </div>
    `).join('');
}

function tempDisplay(t) {
    if (!t || t === 'N/A') return 'N/A';
    const v = parseInt(t) / 1000;
    return isNaN(v) ? 'N/A' : v.toFixed(1) + '\u00b0C';
}

function createNodeCardHTML(nodeId, data) {
    const on = data.status === 'online' && !!data.cpus;
    const sc = on ? 'bg-emerald-500' : 'bg-red-500';
    const st = on ? 'Online' : 'Offline';
    const sg = on
        ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]'
        : 'shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    const ni = NODE_ICONS[nodeId] || '<i class="fa-brands fa-linux text-xl text-slate-400"></i>';
    const mem = on ? parseMem(data.mem) : { total: 0, used: 0, percent: 0 };
    const bc = !on
        ? 'bg-slate-600'
        : mem.percent > 90 ? 'bg-red-500' : mem.percent > 75 ? 'bg-amber-500' : 'bg-emerald-500';
    const nm = data.name || (nodeId[0].toUpperCase() + nodeId.slice(1));

    let details = '';
    if (on) {
        details = `
            <div class="border-t border-slate-700/50 pt-4 mt-4 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">OS</p><p class="text-sm text-slate-300">${data.os || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Uptime</p><p class="text-sm text-slate-300">${data.uptime || 'N/A'}</p></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">CPU Model</p><p class="text-sm text-slate-300 font-mono">${data.cpu_model || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">CPU Temp</p><p class="text-sm text-slate-300 font-mono">${tempDisplay(data.cpu_temp)}</p></div>
                </div>
                <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Load Average</p><p class="text-sm text-slate-300 font-mono">${data.load || 'N/A'}</p></div>
                <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Kernel</p><p class="text-sm text-slate-300 font-mono break-all">${data.kernel || 'N/A'}</p></div>
                <div class="grid grid-cols-2 gap-4">
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Processes</p><p class="text-sm text-slate-300 font-mono">${data.procs || 'N/A'}</p></div>
                    <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Swap</p><p class="text-sm text-slate-300 font-mono node-swap">${swapDisplay(data.swap)}</p></div>
                </div>
                <div class="node-block-devices">${blockDevicesHTML(data)}</div>
            </div>`;
    } else {
        details = '<div class="border-t border-slate-700/50 pt-4 mt-4 flex items-center justify-center py-4"><span class="text-slate-500 italic text-sm">Node unreachable</span></div>';
    }

    return `
        <div id="card-${nodeId}" class="node-card bg-slate-800 rounded-xl p-6 border border-slate-700/50 shadow-lg hover:border-slate-600 transition-all" onclick="toggleNode('${nodeId}')">
            <div class="flex justify-between items-start">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">${ni}</div>
                    <div><h3 class="text-lg font-semibold text-white tracking-wide">${nm}</h3><p class="text-xs text-slate-400 font-mono">${nodeId}</p></div>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
                        <span class="status-dot w-2 h-2 rounded-full ${sc} ${sg}"></span>
                        <span class="status-badge text-xs font-medium text-slate-300">${st}</span>
                    </div>
                    <i id="icon-${nodeId}" class="expand-icon ph ph-caret-down text-lg text-slate-400"></i>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Architecture</p><p class="text-sm text-slate-300 font-mono node-arch">${on ? data.arch || 'N/A' : '--'}</p></div>
                <div><p class="text-xs text-slate-500 uppercase tracking-wider mb-1">CPU Cores</p><p class="text-sm text-slate-300 font-mono node-cpus">${on ? data.cpus || 'N/A' : '--'}</p></div>
            </div>
            <div class="mt-3">
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-slate-400">Memory Usage</span>
                    <span class="text-slate-300 font-mono">${on ? `<span class="node-mem-used">${mem.used}</span> / <span class="node-mem-total">${mem.total}</span> MB (<span class="node-mem-pct">${mem.percent}%</span>)` : '-- / -- MB (--%)'}</span>
                </div>
                <div class="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div class="node-mem-bar ${bc} h-1.5 rounded-full data-transition" style="width:${on ? mem.percent : 0}%"></div>
                </div>
            </div>
            <div id="details-${nodeId}" class="node-details">${details}</div>
        </div>`;
}

let expandedNode = null;

function toggleNode(nodeId) {
    const det = document.getElementById('details-' + nodeId);
    const ic = document.getElementById('icon-' + nodeId);
    const ca = document.getElementById('card-' + nodeId);
    if (!det) return;
    if (expandedNode === nodeId) {
        det.classList.remove('open');
        ic.classList.remove('rotated');
        ca.classList.remove('border-indigo-500', 'ring-1', 'ring-indigo-500');
        expandedNode = null;
    } else {
        if (expandedNode) {
            ['details-', 'icon-', 'card-'].forEach(p => {
                const el = document.getElementById(p + expandedNode);
                if (el) el.classList.remove(...(p === 'details-' ? ['open'] : p === 'icon-' ? ['rotated'] : ['border-indigo-500', 'ring-1', 'ring-indigo-500']));
            });
        }
        det.classList.add('open');
        ic.classList.add('rotated');
        ca.classList.add('border-indigo-500', 'ring-1', 'ring-indigo-500');
        expandedNode = nodeId;
    }
}

function setExpandedSilent(nodeId) {
    const det = document.getElementById('details-' + nodeId);
    const ic = document.getElementById('icon-' + nodeId);
    const ca = document.getElementById('card-' + nodeId);
    if (det) {
        det.classList.add('open');
        ic.classList.add('rotated');
        ca.classList.add('border-indigo-500', 'ring-1', 'ring-indigo-500');
    }
}

function updateNodeCard(nodeId, data) {
    const card = document.getElementById('card-' + nodeId);
    if (!card) return;
    const on = data.status === 'online' && !!data.cpus;
    const mem = on ? parseMem(data.mem) : { total: 0, used: 0, percent: 0 };
    const bc = !on
        ? 'bg-slate-600'
        : mem.percent > 90 ? 'bg-red-500' : mem.percent > 75 ? 'bg-amber-500' : 'bg-emerald-500';
    const badge = card.querySelector('.status-badge');
    if (badge) badge.textContent = on ? 'Online' : 'Offline';
    const dot = card.querySelector('.status-dot');
    if (dot) {
        dot.className = 'status-dot w-2 h-2 rounded-full ' +
            (on
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]');
    }
    const ae = card.querySelector('.node-arch');
    if (ae) ae.textContent = on ? data.arch || 'N/A' : '--';
    const ce = card.querySelector('.node-cpus');
    if (ce) ce.textContent = on ? data.cpus || 'N/A' : '--';
    if (on) {
        const mu = card.querySelector('.node-mem-used');
        if (mu) mu.textContent = mem.used;
        const mt = card.querySelector('.node-mem-total');
        if (mt) mt.textContent = mem.total;
        const mp = card.querySelector('.node-mem-pct');
        if (mp) mp.textContent = mem.percent + '%';
    }
    const sw = card.querySelector('.node-swap');
    if (sw) sw.textContent = on ? swapDisplay(data.swap) : '0 MB';
    const bd = card.querySelector('.node-block-devices');
    if (bd) bd.innerHTML = on ? blockDevicesHTML(data) : '';
    const mb = card.querySelector('.node-mem-bar');
    if (mb) {
        mb.style.width = (on ? mem.percent : 0) + '%';
        mb.className = 'node-mem-bar ' + bc + ' h-1.5 rounded-full data-transition';
    }
}
