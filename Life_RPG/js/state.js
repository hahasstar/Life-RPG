/* =======================================================================
   STATE.JS — 状态管理、localStorage 读写、旧流水彻底清洗与跨天自动刷新
   ======================================================================= */

let state = {
    walletBalance: 0,
    todayEarnings: 0,
    spentToday: 0,
    monthEarnings: 0,
    charXP: 0,
    focusTimeToday: 0,
    questCounts: {},
    questCountsByDate: {},
    questCountsDate: '',
    transactions: [],
    studyRecords: [],
    dailyHistory: [],
    todos: [],
    todayDetails: { quests: [], blindBoxes: [], texts: [] },
    lastDate: '',
    lastMonth: '',
    settings: null,
    todoCustomOrder: false,
    timer: { isRunning: false, startTimestamp: 0, accumulated: 0, desc: '' }
};

function getTodayQuestCounts() {
    const today = getLocalDateString();
    if (!state.questCountsByDate) state.questCountsByDate = {};
    if (!state.questCountsByDate[today]) state.questCountsByDate[today] = {};
    Object.keys(state.questCountsByDate).forEach(d => {
        if (d !== today) delete state.questCountsByDate[d];
    });
    state.questCounts = state.questCountsByDate[today];
    state.questCountsDate = today;
    return state.questCounts;
}

/* 彻底清洗 Wallet Ledger 中混入的旧天数流水（兼容 v12/v13 迁移残留） */
function cleanStaleTransactions() {
    const today = getLocalDateString();
    if (!Array.isArray(state.transactions)) {
        state.transactions = [];
        return;
    }

    const todayQuestTxIds = new Set(
        (state.todayDetails.quests || [])
            .map(q => (typeof q === 'object' ? q.id : null))
            .filter(Boolean)
    );
    const todayStudyIds = new Set(
        (state.studyRecords || [])
            .filter(r => r.date === today)
            .map(r => r.id)
    );
    const todayTodoTxIds = new Set(
        (state.todos || [])
            .filter(t => t.done && t.rewardTxId)
            .map(t => t.rewardTxId)
    );
    const todayBBList = state.todayDetails.blindBoxes || [];

    // 第一步：按来源严格校验每一条流水是否属于今天
    let cleaned = state.transactions.filter(t => {
        if (!t) return false;
        if (!t.id) t.id = generateId();

        // 如果有明确日期且不是今天，直接移除
        if (t.date && t.date !== today) return false;

        // 1) Daily Quest 流水：必须存在于今天的 todayDetails.quests 中
        if (t.linkedQuestId) {
            if (!todayQuestTxIds.has(t.id)) return false;
            t.date = today;
            return true;
        }

        // 2) Focus 专注流水：必须对应今天的 studyRecords
        if (t.linkedId && t.linkedId !== 'bb') {
            if (!todayStudyIds.has(t.linkedId)) return false;
            t.date = today;
            return true;
        }

        // 3) Blind Box 流水：必须对应今天的 todayDetails.blindBoxes
        if (t.linkedId === 'bb') {
            if (todayBBList.length === 0) return false;
            const matched = todayBBList.some(b => String(b).startsWith(t.desc));
            if (!matched) return false;
            t.date = today;
            return true;
        }

        // 4) To-Do 奖励流水：必须对应今天的已完成 todo
        if (t.linkedTodoId) {
            if (!todayTodoTxIds.has(t.id)) return false;
            t.date = today;
            return true;
        }

        // 5) 支出流水：如果今天没有花钱，所有历史支出都不属于今天
        if (t.type === 'spend') {
            if (roundNum(state.spentToday || 0) <= 0) return false;
            t.date = today;
            return true;
        }

        // 6) 其他未标记来源的旧收入流水：如果今天收入为 0 或无日期，一律视为历史残留
        if (roundNum(state.todayEarnings || 0) <= 0) return false;
        if (!t.date) return false;
        return t.date === today;
    });

    // 第二步：如果今天确实有支出，但留下的 spend 流水总和大于 spentToday（说明混入了前几天的支出），
    // 则按时间顺序只保留最近几笔使其不超过 spentToday
    const spendTxs = cleaned.filter(t => t.type === 'spend');
    const spendSum = roundNum(spendTxs.reduce((s, t) => s + Number(t.amount || 0), 0));
    const targetSpent = roundNum(state.spentToday || 0);
    if (spendTxs.length > 0 && spendSum > targetSpent + 0.01) {
        let running = 0;
        const keepSpendIds = new Set();
        for (const t of spendTxs) {
            const amt = roundNum(Number(t.amount || 0));
            if (roundNum(running + amt) <= targetSpent + 0.01) {
                keepSpendIds.add(t.id);
                running = roundNum(running + amt);
            }
        }
        cleaned = cleaned.filter(t => t.type !== 'spend' || keepSpendIds.has(t.id));
    }

    state.transactions = cleaned;
}

function ensureStateDefaults() {
    const today = getLocalDateString();
    if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (!state.settings.theme) state.settings.theme = 'elegant-dark';
    if (!state.settings.fontSize) state.settings.fontSize = 'normal';
    if (!state.settings.baseWorkHours) state.settings.baseWorkHours = 4;
    if (!state.settings.stretchWorkHours) state.settings.stretchWorkHours = 8;
    if (!state.settings.focusBlockMinutes) state.settings.focusBlockMinutes = 40;
    if (!state.settings.focusBlockReward) state.settings.focusBlockReward = 15;
    if (!state.settings.extraFocusMinutes) state.settings.extraFocusMinutes = 10;
    if (!state.settings.extraFocusReward) state.settings.extraFocusReward = 3;
    if (!state.settings.todoRewardMode) state.settings.todoRewardMode = 'fixed';
    if (state.settings.todoRewardAmount === undefined) state.settings.todoRewardAmount = 1;
    if (!state.settings.walletCollapsedMetric) state.settings.walletCollapsedMetric = 'earning';
    if (!Array.isArray(state.settings.mobileOrder) || state.settings.mobileOrder.length !== DEFAULT_MOBILE_ORDER.length) {
        const existing = Array.isArray(state.settings.mobileOrder) ? state.settings.mobileOrder.filter(k => DEFAULT_MOBILE_ORDER.includes(k)) : [];
        const missing = DEFAULT_MOBILE_ORDER.filter(k => !existing.includes(k));
        state.settings.mobileOrder = [...existing, ...missing];
    }
    if (!state.settings.mobileDefaultCollapsed || typeof state.settings.mobileDefaultCollapsed !== 'object') {
        state.settings.mobileDefaultCollapsed = { ...DEFAULT_MOBILE_COLLAPSED };
    } else {
        DEFAULT_MOBILE_ORDER.forEach(k => {
            if (state.settings.mobileDefaultCollapsed[k] === undefined) {
                state.settings.mobileDefaultCollapsed[k] = DEFAULT_MOBILE_COLLAPSED[k];
            }
        });
    }
    if (!state.settings.chunkRows || typeof state.settings.chunkRows !== 'object') {
        state.settings.chunkRows = { ...DEFAULT_CHUNK_ROWS };
    } else {
        Object.keys(DEFAULT_CHUNK_ROWS).forEach(k => {
            if (!state.settings.chunkRows[k] || state.settings.chunkRows[k] < 1) {
                state.settings.chunkRows[k] = DEFAULT_CHUNK_ROWS[k];
            }
        });
    }
    if (!Array.isArray(state.settings.quests) || state.settings.quests.length === 0) {
        state.settings.quests = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.quests));
    }
    state.settings.quests.forEach(q => {
        if (!q.icon) q.icon = '📌';
        if (q.hasInput === undefined) q.hasInput = false;
    });

    if (!state.questCounts) state.questCounts = {};
    if (!state.questCountsByDate) state.questCountsByDate = {};
    if (!state.questCountsDate) state.questCountsDate = state.lastDate || today;

    if (state.questCountsDate === today && Object.keys(state.questCountsByDate).length === 0) {
        state.questCountsByDate[today] = { ...state.questCounts };
    }

    if (!state.transactions) state.transactions = [];
    if (!state.studyRecords) state.studyRecords = [];
    if (!state.dailyHistory) state.dailyHistory = [];
    if (!state.todos) state.todos = [];
    if (!state.todayDetails) state.todayDetails = { quests: [], blindBoxes: [], texts: [] };
    if (!state.todayDetails.quests) state.todayDetails.quests = [];
    if (!state.todayDetails.blindBoxes) state.todayDetails.blindBoxes = [];
    if (!state.todayDetails.texts) state.todayDetails.texts = [];
    if (state.spentToday === undefined) state.spentToday = 0;
    if (state.todoCustomOrder === undefined) state.todoCustomOrder = false;
    if (!state.timer) state.timer = { isRunning: false, startTimestamp: 0, accumulated: 0, desc: '' };

    cleanStaleTransactions();
}

function checkDayRollover(notify = false) {
    const today = getLocalDateString();
    const thisMonth = getLocalMonthString();
    let rolledOver = false;

    if (state.lastDate && state.lastDate !== today) {
        // 1. 归档前一天全部数据（含当天流水）到 dailyHistory
        state.dailyHistory.unshift({
            date: state.lastDate,
            earned: roundNum(state.todayEarnings),
            spent: roundNum(state.spentToday || 0),
            focus: state.focusTimeToday,
            quests: Object.values(state.questCounts || {}).reduce((a, b) => a + b, 0),
            details: {
                todosCompleted: state.todos.filter(t => t.done).map(t => t.text),
                studyRecords: state.studyRecords
                    .filter(r => r.date === state.lastDate)
                    .map(r => ({ desc: r.desc, mins: r.mins, time: r.time })),
                quests: [...state.todayDetails.quests],
                blindBoxes: [...state.todayDetails.blindBoxes],
                texts: [...state.todayDetails.texts],
                transactions: [...state.transactions]
            }
        });
        if (state.dailyHistory.length > 60) state.dailyHistory.pop();

        // 2. 仅保留未完成的 To-Do
        state.todos = state.todos.filter(t => !t.done);

        // 3. 结算昨日 Pending 收入，并彻底清空今日面板数据（含 Wallet Ledger）
        state.walletBalance = roundNum(state.walletBalance + state.todayEarnings);
        state.todayEarnings = 0;
        state.spentToday = 0;
        state.focusTimeToday = 0;
        state.questCountsByDate = { [today]: {} };
        state.questCounts = state.questCountsByDate[today];
        state.questCountsDate = today;
        state.todayDetails = { quests: [], blindBoxes: [], texts: [] };
        state.transactions = [];
        state.lastDate = today;
        rolledOver = true;
    }

    if (state.questCountsDate !== today) {
        state.questCountsByDate = { [today]: {} };
        state.questCounts = state.questCountsByDate[today];
        state.questCountsDate = today;
        rolledOver = true;
    }

    if (state.lastMonth && state.lastMonth !== thisMonth) {
        state.monthEarnings = 0;
        state.lastMonth = thisMonth;
        rolledOver = true;
    }

    if (rolledOver) {
        setDailyQuote();
        saveState();
        if (notify) showToast('🌅 New day started! Wallet Ledger & Daily Quests refreshed.');
    }
    return rolledOver;
}

function loadState() {
    const saved = localStorage.getItem('lifeRpgState') || localStorage.getItem('lifeRpgStateV2');
    const today = getLocalDateString();
    const thisMonth = getLocalMonthString();

    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            state.walletBalance = roundNum(state.settings.initialReserve);
        }
        ensureStateDefaults();
        if (!state.lastDate) state.lastDate = today;
        if (!state.lastMonth) state.lastMonth = thisMonth;
        checkDayRollover(false);
    } else {
        state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        state.walletBalance = roundNum(state.settings.initialReserve);
        state.lastDate = today;
        state.lastMonth = thisMonth;
        state.questCountsDate = today;
        state.questCountsByDate = { [today]: {} };
        state.questCounts = state.questCountsByDate[today];
        ensureStateDefaults();
    }

    getTodayQuestCounts();
    cleanStaleTransactions();
    if (state.transactions.length > 80) state.transactions = state.transactions.slice(0, 80);

    applyTheme(state.settings.theme);
    applyFontSize(state.settings.fontSize);

    if (state.timer && state.timer.isRunning && state.timer.startTimestamp > 0) {
        resumeAbsoluteTimer();
    }
    if (state.timer && state.timer.desc) {
        const descEl = document.getElementById('focusDesc');
        if (descEl) descEl.value = state.timer.desc;
    }

    setDailyQuote();
    saveState(true);
    updateTimerUI();
    if (typeof updateCloudStatusIdle === 'function') updateCloudStatusIdle();
    if (typeof syncWithCloud === 'function' && isCloudConfigured()) syncWithCloud(false);
}

function saveState(skipCloudPush = false) {
    if (!skipCloudPush) {
        state.updatedAt = Date.now();
    }
    localStorage.setItem('lifeRpgState', JSON.stringify(state));
    updateUI();
    if (isTimelineView) renderTimeline();
    if (!skipCloudPush && typeof scheduleCloudPush === 'function') {
        scheduleCloudPush();
    }
}
