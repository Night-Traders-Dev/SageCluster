const STORAGE_KEY = 'sagecluster_history';
const MAX_POINTS = 500;

function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
}

let history = loadHistory();

function saveHistory() {
    setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {}
    }, 2000);
}

function pushHistory(key, value, subKey) {
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (subKey) {
        if (!history[key]) history[key] = {};
        if (!history[key][subKey]) history[key][subKey] = [];
        const arr = history[key][subKey];
        arr.push({ t: label, v: value });
        if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
    } else {
        if (!history[key]) history[key] = [];
        const arr = history[key];
        arr.push({ t: label, v: value });
        if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
    }
}

function getHistoryLabels(key) {
    if (!history[key]) return [];
    if (Array.isArray(history[key])) return history[key].map(p => p.t);
    const first = Object.values(history[key])[0];
    return first ? first.map(p => p.t) : [];
}

function getHistoryValues(key, subKey) {
    if (!history[key]) return [];
    if (subKey) return (history[key][subKey] || []).map(p => p.v);
    if (Array.isArray(history[key])) return history[key].map(p => p.v);
    return [];
}
