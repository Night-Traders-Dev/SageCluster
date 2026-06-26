let token = localStorage.getItem('sage_token') || '';
let currentPath = '';
let entries = [];
let selected = new Set();
let clipboard = {};

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoading() { document.getElementById('loading-overlay').classList.add('show'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('show'); }

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function apiUrl(endpoint, params) {
    let u = endpoint;
    if (params) u += '?' + new URLSearchParams(params);
    return u;
}

async function apiPost(endpoint, data) {
    const r = await fetch(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail || 'API error'); }
    return r.json();
}

async function checkAuth() {
    if (!token) return false;
    try {
        const r = await apiPost('/api/files/list', { token, path: '' });
        return true;
    } catch (e) { return false; }
}

async function doLogin() {
    const pw = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    err.style.display = 'none';
    try {
        const r = await apiPost('/api/files/login', { password: pw });
        token = r.token;
        localStorage.setItem('sage_token', token);
        enterApp();
    } catch (e) {
        err.style.display = 'block';
    }
}

function logout() {
    token = '';
    localStorage.removeItem('sage_token');
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-password').value = '';
}

async function enterApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    await loadStorageInfo();
    await navigateTo('');
}

async function loadStorageInfo() {
    try {
        const r = await fetch('/api/status');
        const d = await r.json();
        const n = d.nodes.orangepi;
        if (n && n.block_devices) {
            for (const dev of n.block_devices) {
                if (dev.mount === '/mnt/storage') {
                    document.getElementById('storage-info').textContent = dev.used + ' / ' + dev.size + ' MB used';
                    return;
                }
            }
        }
    } catch (e) {}
}

async function navigateTo(path) {
    currentPath = path;
    selected.clear();
    updateToolbar();
    showLoading();
    try {
        const r = await apiPost('/api/files/list', { token, path });
        entries = r.entries;
        renderBreadcrumb();
        renderGrid();
        updateStatus();
    } catch (e) {
        showToast('Error: ' + e.message);
        entries = [];
        renderGrid();
    }
    hideLoading();
}

function renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    const parts = currentPath ? currentPath.split('/') : [];
    let html = '<a onclick="navigateTo(\'\')"><i class="ph ph-house" style="font-size:14px"></i></a>';
    let acc = '';
    for (const p of parts) {
        if (!p) continue;
        acc += '/' + p;
        html += '<span>/</span><a onclick="navigateTo(\'' + acc + '\')">' + p + '</a>';
    }
    if (parts.length > 0) html += '<span>/</span>';
    html += '<span class="current">' + (parts.length ? '' : 'root') + '</span>';
    bc.innerHTML = html;
}

function renderGrid() {
    const grid = document.getElementById('file-grid');
    if (entries.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:#64748b"><i class="ph ph-folder-open" style="font-size:40px;display:block;margin-bottom:12px"></i>Empty folder</div>';
        return;
    }
    let html = '';
    for (const e of entries) {
        const sel = selected.has(e.name) ? ' selected' : '';
        let icon, iconColor;
        if (e.is_dir) { icon = 'ph-folder'; iconColor = '#f59e0b'; }
        else if (e.ext === '.zip' || e.ext === '.gz' || e.ext === '.xz' || e.ext === '.tar') { icon = 'ph-file-archive'; iconColor = '#8b5cf6'; }
        else if (['.jpg','.jpeg','.png','.gif','.svg','.webp','.bmp'].includes(e.ext)) { icon = 'ph-file-image'; iconColor = '#ef4444'; }
        else if (['.mp4','.avi','.mkv','.mov','.webm'].includes(e.ext)) { icon = 'ph-file-video'; iconColor = '#f472b6'; }
        else if (['.mp3','.wav','.flac','.ogg'].includes(e.ext)) { icon = 'ph-file-audio'; iconColor = '#34d399'; }
        else if (['.pdf'].includes(e.ext)) { icon = 'ph-file-pdf'; iconColor = '#ef4444'; }
        else if (['.py','.js','.ts','.c','.cpp','.h','.java','.rs','.go','.rb','.sh','.bash','.yaml','.yml','.json','.xml','.toml','.md','.txt','.conf','.cfg','.ini'].includes(e.ext)) { icon = 'ph-file-code'; iconColor = '#3b82f6'; }
        else { icon = 'ph-file'; iconColor = '#94a3b8'; }
        const sizeStr = e.is_dir ? '' : formatSize(e.size);
        html += '<div class="file-item' + sel + '" onclick="selectFile(\'' + e.name.replace(/'/g, "\\'") + '\', event)" ondblclick="openFile(\'' + e.name.replace(/'/g, "\\'") + '\')">';
        html += '<div class="icon"><i class="ph ' + icon + '" style="color:' + iconColor + '"></i></div>';
        html += '<div class="name">' + e.name + '</div>';
        if (sizeStr) html += '<div class="size">' + sizeStr + '</div>';
        html += '</div>';
    }
    grid.innerHTML = html;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function updateStatus() {
    const total = entries.length;
    const dirs = entries.filter(e => e.is_dir).length;
    const files = total - dirs;
    document.getElementById('status-left').textContent = total + ' items (' + dirs + ' dirs, ' + files + ' files)';
    const selSz = selected.size;
    document.getElementById('status-right').textContent = selSz ? selSz + ' selected' : '';
}

function selectFile(name, event) {
    if (event.ctrlKey || event.metaKey) {
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
    } else {
        selected.clear();
        selected.add(name);
    }
    renderGrid();
    updateToolbar();
    updateStatus();
}

function selectAll() {
    if (selected.size === entries.length) selected.clear();
    else entries.forEach(e => selected.add(e.name));
    renderGrid();
    updateToolbar();
    updateStatus();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { selected.clear(); renderGrid(); updateToolbar(); updateStatus(); }
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); selectAll(); }
});

function openFile(name) {
    const e = entries.find(x => x.name === name);
    if (!e) return;
    if (e.is_dir) {
        const newPath = currentPath ? currentPath + '/' + name : name;
        navigateTo(newPath);
    } else {
        selected.clear();
        selected.add(name);
        renderGrid();
        updateToolbar();
        updateStatus();
        downloadSelected();
    }
}

function updateToolbar() {
    const count = selected.size;
    document.getElementById('btn-compress').disabled = count === 0;
    document.getElementById('btn-rename').disabled = count !== 1;
    document.getElementById('btn-delete').disabled = count === 0;
    document.getElementById('btn-download').disabled = count === 0;
    const hasArchive = count === 1 && !entries.find(e => e.name === [...selected][0])?.is_dir && ['.zip','.gz','.xz','.tar'].includes(entries.find(e => e.name === [...selected][0])?.ext || '');
    document.getElementById('btn-extract').disabled = !hasArchive;
}

function showNewFolderModal() {
    document.getElementById('new-folder-name').value = '';
    openModal('modal-new-folder');
    setTimeout(() => document.getElementById('new-folder-name').focus(), 100);
}

async function doMkdir() {
    const name = document.getElementById('new-folder-name').value.trim();
    if (!name) return;
    closeModal('modal-new-folder');
    showLoading();
    try {
        await apiPost('/api/files/mkdir', { token, path: currentPath, name });
        showToast('Folder created');
        await navigateTo(currentPath);
    } catch (e) { showToast('Error: ' + e.message); }
    hideLoading();
}

function showRenameModal() {
    if (selected.size !== 1) return;
    const name = [...selected][0];
    document.getElementById('rename-name').value = name;
    openModal('modal-rename');
    setTimeout(() => document.getElementById('rename-name').focus(), 100);
}

async function doRename() {
    const newName = document.getElementById('rename-name').value.trim();
    if (!newName || selected.size !== 1) return;
    const oldName = [...selected][0];
    closeModal('modal-rename');
    showLoading();
    try {
        await apiPost('/api/files/rename', { token, path: currentPath, old_name: oldName, new_name: newName });
        showToast('Renamed');
        await navigateTo(currentPath);
    } catch (e) { showToast('Error: ' + e.message); }
    hideLoading();
}

function confirmDelete() {
    if (selected.size === 0) return;
    const names = [...selected];
    document.getElementById('delete-msg').textContent = 'Delete ' + names.length + ' item' + (names.length > 1 ? 's' : '') + '? This cannot be undone.';
    openModal('modal-delete');
}

async function doDelete() {
    closeModal('modal-delete');
    showLoading();
    try {
        await apiPost('/api/files/delete', { token, path: currentPath, names: [...selected] });
        showToast('Deleted');
        await navigateTo(currentPath);
    } catch (e) { showToast('Error: ' + e.message); }
    hideLoading();
}

async function handleUpload(files) {
    if (!files.length) return;
    const bar = document.getElementById('progress-bar');
    const prog = document.getElementById('upload-progress');
    prog.style.display = 'block';
    bar.style.width = '0%';
    try {
        const form = new FormData();
        form.append('token', token);
        form.append('path', currentPath);
        for (const f of files) form.append('files', f);
        const r = await fetch('/api/files/upload', { method: 'POST', body: form });
        if (!r.ok) throw Error('Upload failed');
        bar.style.width = '100%';
        setTimeout(() => { prog.style.display = 'none'; bar.style.width = '0%'; }, 800);
        showToast('Uploaded ' + files.length + ' file(s)');
        await navigateTo(currentPath);
    } catch (e) {
        prog.style.display = 'none';
        showToast('Upload error: ' + e.message);
    }
}

async function downloadSelected() {
    if (selected.size === 0) return;
    const name = [...selected][0];
    const e = entries.find(x => x.name === name);
    if (!e || e.is_dir) return;
    const url = '/api/files/download?path=' + encodeURIComponent(currentPath) + '&file=' + encodeURIComponent(name) + '&token=' + encodeURIComponent(token);
    window.open(url, '_blank');
}

function showCompressModal() {
    if (selected.size === 0) return;
    document.getElementById('compress-name').value = 'archive';
    openModal('modal-compress');
}

async function doCompress() {
    const archiveName = document.getElementById('compress-name').value.trim() || 'archive';
    const format = document.getElementById('compress-format').value;
    closeModal('modal-compress');
    showLoading();
    try {
        const r = await apiPost('/api/files/compress', {
            token, path: currentPath, names: [...selected], format, archive_name: archiveName + '.' + format,
        });
        showToast('Compressed as ' + r.archive);
        await navigateTo(currentPath);
    } catch (e) { showToast('Error: ' + e.message); }
    hideLoading();
}

function showExtractModal() {
    if (selected.size !== 1) return;
    const name = [...selected][0];
    document.getElementById('extract-msg').textContent = 'Extract "' + name + '" into current folder?';
    openModal('modal-extract');
}

async function doExtract() {
    const name = [...selected][0];
    closeModal('modal-extract');
    showLoading();
    try {
        await apiPost('/api/files/extract', { token, path: currentPath, archive: name });
        showToast('Extracted');
        await navigateTo(currentPath);
    } catch (e) { showToast('Error: ' + e.message); }
    hideLoading();
}

async function refreshFiles() {
    await navigateTo(currentPath);
}

// Drag & Drop
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
    dragCounter++;
    if (dragCounter === 1) document.getElementById('drop-zone').classList.add('dragging');
});
document.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter === 0) document.getElementById('drop-zone').classList.remove('dragging');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.getElementById('drop-zone').classList.remove('dragging');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
    if (token && await checkAuth()) {
        enterApp();
    }
});
