/* =======================================================================
   SYNC.JS — Cross-device Cloud Sync via Supabase REST API (Zero-dependency)
   ======================================================================= */

const CLOUD_CONFIG_KEY = 'lifeRpgCloudConfig';
let cloudPushTimer = null;
let isCloudSyncing = false;

function getCloudConfig() {
    try {
        const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
        if (!raw) return { url: '', anonKey: '', syncKey: '' };
        const parsed = JSON.parse(raw);
        return {
            url: (parsed.url || '').trim().replace(/\/+$/, ''),
            anonKey: (parsed.anonKey || '').trim(),
            syncKey: (parsed.syncKey || '').trim()
        };
    } catch (e) {
        return { url: '', anonKey: '', syncKey: '' };
    }
}

function isCloudConfigured() {
    const cfg = getCloudConfig();
    return Boolean(cfg.url && cfg.anonKey && cfg.syncKey);
}

function setCloudStatusUI(status, text) {
    const el = document.getElementById('cloudStatusBtn');
    if (!el) return;
    el.textContent = text;
    el.dataset.status = status;
}

function updateCloudStatusIdle() {
    if (!isCloudConfigured()) {
        setCloudStatusUI('local', '☁️ Local');
    } else if (!navigator.onLine) {
        setCloudStatusUI('offline', '☁️ Offline');
    } else {
        setCloudStatusUI('synced', '☁️ Synced');
    }
}

function saveCloudConfigFromUI() {
    const url = (document.getElementById('setCloudUrl').value || '').trim().replace(/\/+$/, '');
    const anonKey = (document.getElementById('setCloudKey').value || '').trim();
    const syncKey = (document.getElementById('setCloudSyncId').value || '').trim();

    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ url, anonKey, syncKey }));
    updateCloudStatusIdle();

    if (url && anonKey && syncKey) {
        showToast('☁️ Cloud config saved. Syncing...');
        syncWithCloud(true);
    } else {
        showToast('☁️ Switched to Local-only mode');
    }
}

function scheduleCloudPush() {
    if (!isCloudConfigured() || !navigator.onLine) return;
    clearTimeout(cloudPushTimer);
    setCloudStatusUI('syncing', '☁️ Syncing...');
    cloudPushTimer = setTimeout(() => {
        pushToCloud(false);
    }, 1500);
}

async function pushToCloud(manual = false) {
    if (!isCloudConfigured()) {
        if (manual) alert('Please enter Supabase Project URL, Anon Key, and Sync Passphrase first.');
        return false;
    }
    if (!navigator.onLine) {
        setCloudStatusUI('offline', '☁️ Offline');
        if (manual) showToast('⚠️ Offline. Changes will sync automatically when back online.');
        return false;
    }

    const cfg = getCloudConfig();
    const endpoint = `${cfg.url}/rest/v1/life_rpg_saves`;
    const nowTs = state.updatedAt || Date.now();
    state.updatedAt = nowTs;

    isCloudSyncing = true;
    setCloudStatusUI('syncing', '☁️ Uploading...');

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': cfg.anonKey,
                'Authorization': `Bearer ${cfg.anonKey}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                id: cfg.syncKey,
                data: state,
                updated_at: nowTs
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        setCloudStatusUI('synced', '☁️ Synced');
        if (manual) showToast('☁️ Uploaded to cloud successfully');
        return true;
    } catch (err) {
        console.error('[Cloud Push Error]', err);
        setCloudStatusUI('error', '☁️ Sync Error');
        if (manual) alert('Upload failed. Please verify your Supabase URL, Key, and table setup:\n' + err.message);
        return false;
    } finally {
        isCloudSyncing = false;
    }
}

async function pullFromCloud(manual = false, forceOverwrite = false) {
    if (!isCloudConfigured()) {
        if (manual) alert('Please enter Supabase Project URL, Anon Key, and Sync Passphrase first.');
        return false;
    }
    if (!navigator.onLine) {
        setCloudStatusUI('offline', '☁️ Offline');
        if (manual) showToast('⚠️ Offline. Unable to pull from cloud.');
        return false;
    }

    const cfg = getCloudConfig();
    const endpoint = `${cfg.url}/rest/v1/life_rpg_saves?id=eq.${encodeURIComponent(cfg.syncKey)}&select=data,updated_at`;

    isCloudSyncing = true;
    setCloudStatusUI('syncing', '☁️ Checking...');

    try {
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'apikey': cfg.anonKey,
                'Authorization': `Bearer ${cfg.anonKey}`
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            setCloudStatusUI('synced', '☁️ Synced');
            if (manual) showToast('☁️ No cloud save found. Uploading current local state.');
            await pushToCloud(false);
            return true;
        }

        const remoteRow = rows[0];
        const remoteUpdatedAt = Number(remoteRow.updated_at || 0);
        const localUpdatedAt = Number(state.updatedAt || 0);

        if (forceOverwrite || remoteUpdatedAt > localUpdatedAt) {
            if (remoteRow.data && typeof remoteRow.data === 'object') {
                state = remoteRow.data;
                state.updatedAt = remoteUpdatedAt;
                ensureStateDefaults();
                checkDayRollover(false);
                getTodayQuestCounts();
                cleanStaleTransactions();
                applyTheme(state.settings.theme);
                applyFontSize(state.settings.fontSize);
                if (state.timer && state.timer.isRunning && state.timer.startTimestamp > 0) {
                    resumeAbsoluteTimer();
                }
                if (state.timer && state.timer.desc) {
                    const descEl = document.getElementById('focusDesc');
                    if (descEl) descEl.value = state.timer.desc;
                }
                saveState(true);
                updateTimerUI();
                if (typeof applyLayoutPreferences === 'function') applyLayoutPreferences();
                showToast('☁️ Synced latest progress from cloud');
            }
        } else if (localUpdatedAt > remoteUpdatedAt) {
            await pushToCloud(false);
            if (manual) showToast('☁️ Local state is newer; synced to cloud');
        } else {
            if (manual) showToast('☁️ Already up to date');
        }

        setCloudStatusUI('synced', '☁️ Synced');
        return true;
    } catch (err) {
        console.error('[Cloud Pull Error]', err);
        setCloudStatusUI('error', '☁️ Sync Error');
        if (manual) alert('Pull failed. Please check your network or Supabase settings:\n' + err.message);
        return false;
    } finally {
        isCloudSyncing = false;
    }
}

function syncWithCloud(manual = false) {
    if (!isCloudConfigured()) {
        if (manual) openSettings();
        return;
    }
    if (isCloudSyncing) return;
    pullFromCloud(manual, false);
}

window.addEventListener('online', () => {
    updateCloudStatusIdle();
    if (isCloudConfigured()) syncWithCloud(false);
});
window.addEventListener('offline', () => {
    updateCloudStatusIdle();
});

/* Lightweight 20s silent check: fetches only updated_at (~50 bytes) first */
async function silentCloudCheck() {
    if (!isCloudConfigured() || !navigator.onLine || document.hidden || isCloudSyncing) return;

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    const cfg = getCloudConfig();
    const checkUrl = `${cfg.url}/rest/v1/life_rpg_saves?id=eq.${encodeURIComponent(cfg.syncKey)}&select=updated_at`;

    try {
        const res = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'apikey': cfg.anonKey,
                'Authorization': `Bearer ${cfg.anonKey}`
            }
        });
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;

        const remoteUpdatedAt = Number(rows[0].updated_at || 0);
        const localUpdatedAt = Number(state.updatedAt || 0);

        if (remoteUpdatedAt > localUpdatedAt) {
            await pullFromCloud(false, false);
        }
    } catch (e) {
        // Silent check errors are intentionally ignored
    }
}

setInterval(silentCloudCheck, 20000);
