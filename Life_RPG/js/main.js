/* =======================================================================
   MAIN.JS — Layout/Collapse Manager, Theme/Font, Settings, Import/Export & Boot
   ======================================================================= */

let isTimelineView = false;

/* =======================================================================
   LAYOUT & COLLAPSE MANAGER (Desktop aligned heights + Mobile order/collapse/long-press)
   ======================================================================= */
const runtimeCollapsed = {};
let lastIsMobileViewport = null;
let activeReorderChunk = null;
let justLongPressed = false;

function isMobileViewport() {
    return window.innerWidth <= 900;
}

function initPanelCollapseStates(forceReset = false) {
    const mobile = isMobileViewport();
    if (!forceReset && lastIsMobileViewport === mobile) return;
    lastIsMobileViewport = mobile;

    DEFAULT_MOBILE_ORDER.forEach(chunkId => {
        if (mobile) {
            runtimeCollapsed[chunkId] = Boolean(
                state.settings.mobileDefaultCollapsed && state.settings.mobileDefaultCollapsed[chunkId]
            );
        } else {
            runtimeCollapsed[chunkId] = false;
        }
    });
}

function togglePanelCollapse(chunkId, e) {
    if (e) e.stopPropagation();
    runtimeCollapsed[chunkId] = !runtimeCollapsed[chunkId];
    applyLayoutPreferences();
}

function handlePanelHeaderClick(chunkId, e) {
    if (justLongPressed) {
        justLongPressed = false;
        return;
    }
    if (e.target.closest('button, select, input, .pill-badge')) return;
    if (activeReorderChunk) return;
    togglePanelCollapse(chunkId);
}

function changeWalletCollapsedMetric(val) {
    state.settings.walletCollapsedMetric = val;
    saveState();
}

function calcPanelHeightForRows(chunkId, rows) {
    const r = Math.max(1, Number(rows) || 6);
    if (chunkId === 'todo') return Math.round(132 + r * 43);
    if (chunkId === 'dailyQuests') return Math.round(138 + r * 46);
    if (chunkId === 'studyRecords') return Math.round(132 + r * 54);
    if (chunkId === 'walletLedger') return Math.round(132 + r * 46);
    if (chunkId === 'blindBoxHistory') return Math.round(86 + r * 42);
    return null;
}

function applyLayoutPreferences() {
    if (!state || !state.settings) return;
    initPanelCollapseStates(false);

    const mobile = isMobileViewport();
    const orderList = state.settings.mobileOrder || DEFAULT_MOBILE_ORDER;
    const rowsCfg = state.settings.chunkRows || DEFAULT_CHUNK_ROWS;

    // 1. Apply order and collapsed state
    document.querySelectorAll('.panel[data-chunk]').forEach(panel => {
        const chunkId = panel.getAttribute('data-chunk');
        const idx = orderList.indexOf(chunkId);
        panel.style.order = mobile ? (idx >= 0 ? idx : 99) : '';

        const collapsed = Boolean(runtimeCollapsed[chunkId]);
        panel.classList.toggle('is-collapsed', collapsed);

        const btn = panel.querySelector('.collapse-btn');
        if (btn) btn.textContent = collapsed ? '▸' : '▾';
    });

    // 2. Apply visible rows height per chunk
    const hTodo = calcPanelHeightForRows('todo', rowsCfg.todo);
    const hQuests = calcPanelHeightForRows('dailyQuests', rowsCfg.dailyQuests);
    const hStudy = calcPanelHeightForRows('studyRecords', rowsCfg.studyRecords);
    const hLedger = calcPanelHeightForRows('walletLedger', rowsCfg.walletLedger);
    const hBBHist = calcPanelHeightForRows('blindBoxHistory', rowsCfg.blindBoxHistory);

    const setHeight = (chunkId, px) => {
        const panel = document.querySelector(`.panel[data-chunk="${chunkId}"]`);
        if (!panel) return;
        if (runtimeCollapsed[chunkId] || !px) {
            panel.style.height = '';
            panel.style.maxHeight = '';
        } else {
            panel.style.height = `${px}px`;
            panel.style.maxHeight = `${px}px`;
        }
    };

    if (!mobile) {
        // Desktop: side-by-side paired chunks always match the taller one
        const row3Max = Math.max(hTodo, hQuests);
        setHeight('todo', row3Max);
        setHeight('dailyQuests', row3Max);

        const row4Max = Math.max(hStudy, hLedger);
        setHeight('studyRecords', row4Max);
        setHeight('walletLedger', row4Max);

        const row5Max = Math.max(270, hBBHist);
        setHeight('blindBox', row5Max);
        setHeight('blindBoxHistory', row5Max);
    } else {
        // Mobile: single column, each chunk uses its own row height
        setHeight('todo', hTodo);
        setHeight('dailyQuests', hQuests);
        setHeight('studyRecords', hStudy);
        setHeight('walletLedger', hLedger);
        setHeight('blindBox', null);
        setHeight('blindBoxHistory', hBBHist);
    }
}

/* --- Mobile Long-Press on Panel Header to Reorder Chunks --- */
function initMobileLongPressReorder() {
    let pressTimer = null;
    document.querySelectorAll('.panel[data-chunk] .panel-header').forEach(header => {
        const panel = header.closest('.panel[data-chunk]');
        const chunkId = panel.getAttribute('data-chunk');

        const startPress = (e) => {
            if (!isMobileViewport()) return;
            if (e.target.closest('button, select, input, .pill-badge')) return;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                justLongPressed = true;
                if (navigator.vibrate) navigator.vibrate(20);
                openQuickReorderBar(chunkId);
                setTimeout(() => { justLongPressed = false; }, 400);
            }, 500);
        };
        const cancelPress = () => clearTimeout(pressTimer);

        header.addEventListener('touchstart', startPress, { passive: true });
        header.addEventListener('touchend', cancelPress);
        header.addEventListener('touchmove', cancelPress);
        header.addEventListener('touchcancel', cancelPress);
    });
}

function openQuickReorderBar(chunkId) {
    activeReorderChunk = chunkId;
    document.querySelectorAll('.panel[data-chunk]').forEach(p => {
        p.classList.toggle('reorder-active', p.getAttribute('data-chunk') === chunkId);
    });
    const bar = document.getElementById('quickReorderBar');
    const labelEl = document.getElementById('quickReorderLabel');
    if (labelEl) labelEl.textContent = CHUNK_META[chunkId]?.label || chunkId;
    if (bar) bar.style.display = 'flex';
}

function moveActiveChunk(dir) {
    if (!activeReorderChunk) return;
    const list = state.settings.mobileOrder;
    const idx = list.indexOf(activeReorderChunk);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(target, 0, item);
    saveState();
    applyLayoutPreferences();
    const el = document.querySelector(`.panel[data-chunk="${activeReorderChunk}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeQuickReorderBar() {
    activeReorderChunk = null;
    document.querySelectorAll('.panel[data-chunk]').forEach(p => p.classList.remove('reorder-active'));
    const bar = document.getElementById('quickReorderBar');
    if (bar) bar.style.display = 'none';
}

/* --- Settings: Mobile Layout Order & Collapse Manager --- */
let tempMobileOrder = [];
let tempMobileCollapsed = {};

function renderSettingsLayoutManager() {
    const container = document.getElementById('settingsMobileOrderList');
    if (!container) return;
    container.innerHTML = tempMobileOrder.map((chunkId, i) => {
        const meta = CHUNK_META[chunkId] || { label: chunkId };
        const checked = tempMobileCollapsed[chunkId] ? 'checked' : '';
        return `
            <div class="layout-edit-row">
                <span style="font-weight:500;">${i + 1}. ${escapeHtml(meta.label)}</span>
                <label style="display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--text-secondary);">
                    <input type="checkbox" ${checked} onchange="tempMobileCollapsed['${chunkId}']=this.checked"> Collapse by default
                </label>
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                    <button class="btn-tertiary" onclick="moveTempLayoutChunk(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move Up">↑</button>
                    <button class="btn-tertiary" onclick="moveTempLayoutChunk(${i}, 1)" ${i === tempMobileOrder.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
                </div>
            </div>
        `;
    }).join('');
}

function moveTempLayoutChunk(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= tempMobileOrder.length) return;
    const [item] = tempMobileOrder.splice(index, 1);
    tempMobileOrder.splice(target, 0, item);
    renderSettingsLayoutManager();
}

function resetDefaultMobileLayout() {
    tempMobileOrder = [...DEFAULT_MOBILE_ORDER];
    tempMobileCollapsed = { ...DEFAULT_MOBILE_COLLAPSED };
    renderSettingsLayoutManager();
}

window.addEventListener('resize', () => {
    applyLayoutPreferences();
});

/* =======================================================================
   PAGE TOGGLE, THEME & FONT SIZE
   ======================================================================= */
function togglePages() {
    isTimelineView = !isTimelineView;
    document.getElementById('dashboardPage').style.display = isTimelineView ? 'none' : '';
    document.getElementById('timelinePage').style.display = isTimelineView ? 'block' : 'none';
    document.getElementById('btnTogglePage').textContent = isTimelineView ? '📊 Dashboard' : '🕰️ Timeline';
    if (isTimelineView) renderTimeline();
}

function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName || 'elegant-dark');
}
function previewTheme(val) { applyTheme(val); }

function applyFontSize(sizeName) {
    const root = document.documentElement;
    if (sizeName === 'large') {
        root.style.setProperty('--fs-base', '17px');
        root.style.setProperty('--fs-title', '36px');
        root.style.setProperty('--fs-section', '15px');
        root.style.setProperty('--fs-card', '16px');
        root.style.setProperty('--fs-small', '15px');
        root.style.setProperty('--fs-xsmall', '13px');
        root.style.setProperty('--fs-stat', '27px');
        root.style.setProperty('--fs-timer', '72px');
    } else if (sizeName === 'xlarge') {
        root.style.setProperty('--fs-base', '19px');
        root.style.setProperty('--fs-title', '40px');
        root.style.setProperty('--fs-section', '16px');
        root.style.setProperty('--fs-card', '18px');
        root.style.setProperty('--fs-small', '16px');
        root.style.setProperty('--fs-xsmall', '14px');
        root.style.setProperty('--fs-stat', '30px');
        root.style.setProperty('--fs-timer', '80px');
    } else {
        root.style.setProperty('--fs-base', '15px');
        root.style.setProperty('--fs-title', '32px');
        root.style.setProperty('--fs-section', '14px');
        root.style.setProperty('--fs-card', '15px');
        root.style.setProperty('--fs-small', '13px');
        root.style.setProperty('--fs-xsmall', '12px');
        root.style.setProperty('--fs-stat', '24px');
        root.style.setProperty('--fs-timer', '64px');
    }
}
function previewFontSize(val) { applyFontSize(val); }

/* =======================================================================
   SETTINGS MODAL
   ======================================================================= */
let tempSettingsQuests = [];

function toggleTodoRewardInput() {
    const mode = document.getElementById('setTodoRewardMode').value;
    document.getElementById('todoFixedAmtGroup').style.display = (mode === 'fixed') ? 'inline-flex' : 'none';
}

function openSettings() {
    document.getElementById('setTheme').value = state.settings.theme || 'elegant-dark';
    document.getElementById('setFontSize').value = state.settings.fontSize || 'normal';
    document.getElementById('setDailyCap').value = state.settings.dailyCap;
    document.getElementById('setMonthCap').value = state.settings.monthlyCap;
    document.getElementById('setBaseFocus').value = state.settings.baseWorkHours || 4;
    document.getElementById('setTodoRewardMode').value = state.settings.todoRewardMode || 'fixed';
    document.getElementById('setTodoRewardAmount').value = state.settings.todoRewardAmount !== undefined ? state.settings.todoRewardAmount : 1;
    toggleTodoRewardInput();

    if (typeof getCloudConfig === 'function') {
        const cCfg = getCloudConfig();
        const urlEl = document.getElementById('setCloudUrl');
        const keyEl = document.getElementById('setCloudKey');
        const idEl = document.getElementById('setCloudSyncId');
        if (urlEl) urlEl.value = cCfg.url;
        if (keyEl) keyEl.value = cCfg.anonKey;
        if (idEl) idEl.value = cCfg.syncKey;
    }

    tempMobileOrder = [...(state.settings.mobileOrder || DEFAULT_MOBILE_ORDER)];
    tempMobileCollapsed = { ...(state.settings.mobileDefaultCollapsed || DEFAULT_MOBILE_COLLAPSED) };
    renderSettingsLayoutManager();

    const rowsCfg = state.settings.chunkRows || DEFAULT_CHUNK_ROWS;
    document.getElementById('setRowsTodo').value = rowsCfg.todo || 8;
    document.getElementById('setRowsQuests').value = rowsCfg.dailyQuests || 3;
    document.getElementById('setRowsStudy').value = rowsCfg.studyRecords || 6;
    document.getElementById('setRowsLedger').value = rowsCfg.walletLedger || 6;
    document.getElementById('setRowsBBHist').value = rowsCfg.blindBoxHistory || 4;

    tempSettingsQuests = JSON.parse(JSON.stringify(state.settings.quests));
    renderSettingsQuests();
    document.getElementById('settingsModal').style.display = 'block';
}

function closeSettings() {
    applyTheme(state.settings.theme);
    applyFontSize(state.settings.fontSize);
    document.getElementById('settingsModal').style.display = 'none';
}

function renderSettingsQuests() {
    const container = document.getElementById('settingsQuestList');
    container.innerHTML = tempSettingsQuests.map((q, i) => `
        <div class="quest-edit-row">
            <input type="text" value="${escapeHtml(q.icon || '')}" onchange="tempSettingsQuests[${i}].icon=this.value" style="text-align:center; padding:6px;">
            <input type="text" value="${escapeHtml(q.name)}" onchange="tempSettingsQuests[${i}].name=this.value" style="padding:6px 8px;">
            <select onchange="tempSettingsQuests[${i}].category=this.value" style="padding:6px;">
                <option value="Essentials" ${q.category === 'Essentials' ? 'selected' : ''}>Essentials</option>
                <option value="Scholar" ${q.category === 'Scholar' ? 'selected' : ''}>Scholar</option>
            </select>
            <input type="number" value="${q.xp}" onchange="tempSettingsQuests[${i}].xp=Number(this.value)" style="padding:6px;">
            <input type="number" value="${q.limit}" min="1" onchange="tempSettingsQuests[${i}].limit=Math.max(1, Number(this.value))" style="padding:6px;">
            <label style="display:flex; align-items:center; justify-content:center; gap:4px; font-size:12px;">
                <input type="checkbox" ${q.hasInput ? 'checked' : ''} onchange="tempSettingsQuests[${i}].hasInput=this.checked"> Ask
            </label>
            <div style="display:flex; gap:2px; justify-content:center;">
                <button class="btn-tertiary" onclick="moveTempQuest(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move Up">↑</button>
                <button class="btn-tertiary" onclick="moveTempQuest(${i}, 1)" ${i === tempSettingsQuests.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
            </div>
            <button class="btn-tertiary" style="color:var(--red-error);" onclick="removeTempQuest(${i})" title="Delete">✖</button>
        </div>
    `).join('');
}

function moveTempQuest(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= tempSettingsQuests.length) return;
    const [item] = tempSettingsQuests.splice(index, 1);
    tempSettingsQuests.splice(target, 0, item);
    renderSettingsQuests();
}

function addTempQuest() {
    tempSettingsQuests.push({ id: 'q_' + Date.now(), icon: '📌', category: 'Essentials', name: 'New Quest', xp: 1, limit: 1, hasInput: false });
    renderSettingsQuests();
    const list = document.getElementById('settingsQuestList');
    list.scrollTop = list.scrollHeight;
}

function removeTempQuest(index) {
    tempSettingsQuests.splice(index, 1);
    renderSettingsQuests();
}

function saveSettings() {
    const dCap = Number(document.getElementById('setDailyCap').value);
    const mCap = Number(document.getElementById('setMonthCap').value);
    const bFocus = Number(document.getElementById('setBaseFocus').value);
    const theme = document.getElementById('setTheme').value;
    const fSize = document.getElementById('setFontSize').value;
    const todoMode = document.getElementById('setTodoRewardMode').value;
    const todoAmt = roundNum(parseFloat(document.getElementById('setTodoRewardAmount').value));

    if (dCap < 0 || mCap < 0 || bFocus <= 0) return alert('Caps must be >= 0 and Base Focus Goal must be > 0.');
    if (todoMode === 'fixed' && (isNaN(todoAmt) || todoAmt < 0)) return alert('To-Do reward amount must be >= 0.');

    state.settings.theme = theme;
    state.settings.fontSize = fSize;
    state.settings.dailyCap = dCap;
    state.settings.monthlyCap = mCap;
    state.settings.baseWorkHours = bFocus;
    state.settings.todoRewardMode = todoMode;
    state.settings.todoRewardAmount = isNaN(todoAmt) ? 1 : todoAmt;
    state.settings.quests = tempSettingsQuests;
    state.settings.mobileOrder = [...tempMobileOrder];
    state.settings.mobileDefaultCollapsed = { ...tempMobileCollapsed };
    state.settings.chunkRows = {
        todo: Math.max(2, Math.min(30, parseInt(document.getElementById('setRowsTodo').value, 10) || 8)),
        dailyQuests: Math.max(2, Math.min(30, parseInt(document.getElementById('setRowsQuests').value, 10) || 3)),
        studyRecords: Math.max(2, Math.min(30, parseInt(document.getElementById('setRowsStudy').value, 10) || 6)),
        walletLedger: Math.max(2, Math.min(30, parseInt(document.getElementById('setRowsLedger').value, 10) || 6)),
        blindBoxHistory: Math.max(2, Math.min(30, parseInt(document.getElementById('setRowsBBHist').value, 10) || 4))
    };

    initPanelCollapseStates(true);
    saveState();
    applyLayoutPreferences();
    closeSettings();
    showToast('✅ Settings saved.');
}

function resetTodayData() {
    if (!confirm("Reset TODAY'S earnings, expenses, focus time, and quests?\n(Spent money today will be refunded to your balance. Past days remain safe.)")) return;

    const today = getLocalDateString();
    let charXPReduction = 0;
    for (const qId in state.questCounts) {
        const q = state.settings.quests.find(x => x.id === qId);
        if (q) charXPReduction += q.xp * state.questCounts[qId];
    }
    state.studyRecords.filter(r => r.date === today).forEach(r => charXPReduction += r.charXP);
    charXPReduction += state.todayDetails.blindBoxes.length;
    state.todos.filter(t => t.done && t.awardedCharXP).forEach(t => charXPReduction += t.awardedCharXP);

    state.charXP = Math.max(0, roundNum(state.charXP - charXPReduction));
    state.walletBalance = roundNum(state.walletBalance - state.todayEarnings + state.spentToday);
    state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - state.todayEarnings));
    state.todayEarnings = 0;
    state.spentToday = 0;
    state.focusTimeToday = 0;
    state.questCountsByDate = { [today]: {} };
    state.questCounts = state.questCountsByDate[today];
    state.questCountsDate = today;
    state.todayDetails = { quests: [], blindBoxes: [], texts: [] };
    state.studyRecords = state.studyRecords.filter(r => r.date !== today);
    state.transactions = [];
    state.todos.forEach(t => { delete t.rewardTxId; delete t.awardedAmount; delete t.awardedCharXP; });

    saveState();
    closeSettings();
    showToast("↺ Today's progress reset.");
}

/* =======================================================================
   EXPORT / IMPORT & LIFECYCLE
   ======================================================================= */
function exportData() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `LifeRPG_Backup_${getLocalDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported && imported.walletBalance !== undefined) {
                state = imported;
                ensureStateDefaults();
                checkDayRollover(false);
                saveState();
                location.reload();
            } else {
                alert('Invalid backup file structure.');
            }
        } catch (err) {
            alert('Error parsing JSON file.');
        }
    };
    reader.readAsText(file);
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        checkDayRollover(true);
        if (typeof syncWithCloud === 'function' && isCloudConfigured()) syncWithCloud(false);
    }
});
window.addEventListener('focus', () => checkDayRollover(true));
setInterval(() => checkDayRollover(true), 60000);

window.onload = function () {
    initConfettiCanvas();
    loadState();
    initPanelCollapseStates(true);
    applyLayoutPreferences();
    initMobileLongPressReorder();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
};
