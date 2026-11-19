/* =======================================================================
   VIEWS.JS — Dashboard 渲染、Daily Records 弹窗与 7 天 Timeline 渲染
   ======================================================================= */

function updateUI() {
    const todayStr = getLocalDateString();

    // Character Profile
    const level = calculateLevel(state.charXP);
    document.getElementById('charLevel').innerText = level;
    document.getElementById('charXP').innerText = roundNum(state.charXP);
    const curLvlXP = Math.pow(level - 1, 2) * 10;
    const nextLvlXP = Math.pow(level, 2) * 10;
    const charPct = Math.min(100, Math.max(0, ((state.charXP - curLvlXP) / (nextLvlXP - curLvlXP)) * 100));
    document.getElementById('charProgress').style.width = `${charPct}%`;

    // Wallet
    document.getElementById('walletBalance').innerText = state.walletBalance.toFixed(2);
    document.getElementById('spentTodayDisplay').innerText = `${state.spentToday.toFixed(2)} HK$`;
    document.getElementById('todayEarnings').innerText = `${state.todayEarnings.toFixed(1)} / ${state.settings.dailyCap}`;
    document.getElementById('monthEarnings').innerText = `${state.monthEarnings.toFixed(1)} / ${state.settings.monthlyCap}`;
    document.getElementById('todayProgress').style.width = `${Math.min(100, (state.todayEarnings / Math.max(1, state.settings.dailyCap)) * 100)}%`;
    document.getElementById('monthProgress').style.width = `${Math.min(100, (state.monthEarnings / Math.max(1, state.settings.monthlyCap)) * 100)}%`;

    // Focus Goal
    const bGoal = state.settings.baseWorkHours || 4;
    document.getElementById('baseGoalDisplay').innerText = bGoal;
    const focusHours = Math.floor(state.focusTimeToday / 60);
    const focusMins = state.focusTimeToday % 60;
    document.getElementById('todayFocus').innerText = `${focusHours}h ${focusMins}m`;

    const basePct = Math.min(100, (state.focusTimeToday / (bGoal * 60)) * 100);
    const stretchPct = Math.min(100, (state.focusTimeToday / (8 * 60)) * 100);
    document.getElementById('focusBaseProgressText').innerText = `${Math.round(basePct)}%`;
    document.getElementById('focusBaseProgress').style.width = `${basePct}%`;
    document.getElementById('focusStretchProgressText').innerText = `${Math.round(stretchPct)}%`;
    document.getElementById('focusStretchProgress').style.width = `${stretchPct}%`;

    // To-Do Reward Badge
    const todoBadge = document.getElementById('todoRewardBadge');
    if (state.settings.todoRewardMode === 'blindbox') {
        todoBadge.textContent = '🎁 Blind Box';
    } else {
        todoBadge.textContent = `+${state.settings.todoRewardAmount ?? 1} HK$ / task`;
    }

    // To-Do List
    const todoListEl = document.getElementById('todoList');
    todoListEl.innerHTML = state.todos.length === 0
        ? '<div style="color:var(--text-secondary); font-size:var(--fs-small); padding:8px 0;">No tasks yet. Add one above!</div>'
        : state.todos.map(t => `
            <div class="todo-item" draggable="true"
                 ondragstart="handleDragStart(event, '${t.id}')"
                 ondragover="handleDragOver(event)"
                 ondrop="handleDrop(event, '${t.id}')"
                 ondragend="handleDragEnd(event)">
                <div class="drag-handle" title="Drag to reorder">☰</div>
                <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo('${t.id}', event)">
                <input type="text" class="todo-input-inline ${t.done ? 'todo-done' : ''}"
                       value="${escapeHtml(t.text)}"
                       onblur="updateTodoText('${t.id}', this.value)"
                       onkeypress="if(event.key==='Enter') this.blur();">
                <button class="btn-tertiary" onclick="deleteTodo('${t.id}')" title="Delete">✖</button>
            </div>
        `).join('');

    // Daily Quests — 严格只显示当天进度
    const effectiveCounts = getTodayQuestCounts();
    document.getElementById('questDateTag').textContent = todayStr;
    const essDiv = document.getElementById('questListEssentials');
    const schDiv = document.getElementById('questListScholar');

    const renderQuestCategory = (category) => {
        const items = state.settings.quests.filter(q => q.category === category);
        const active = items.filter(q => (effectiveCounts[q.id] || 0) < q.limit);
        const done = items.filter(q => (effectiveCounts[q.id] || 0) >= q.limit);
        return [...active, ...done].map(q => {
            const count = effectiveCounts[q.id] || 0;
            const isDone = count >= q.limit;
            return `
                <div class="quest-item ${isDone ? 'completed' : ''}" onclick="${isDone ? '' : `claimQuest('${q.id}', event)`}">
                    <div class="quest-info">
                        <span>${escapeHtml(q.icon || '📌')}</span>
                        <span class="quest-name-text">${escapeHtml(q.name)}</span>
                    </div>
                    <div class="quest-actions">
                        ${q.hasInput && !isDone ? '<span style="font-size:11px; opacity:0.65;" title="Prompts for time/note">✎</span>' : ''}
                        ${isDone ? '<span class="green-text" style="font-size:13px;">✓</span>' : `<span class="quest-reward">+${q.xp}</span>`}
                        <span class="quest-count">${count}/${q.limit}</span>
                    </div>
                </div>
            `;
        }).join('');
    };
    essDiv.innerHTML = renderQuestCategory('Essentials');
    schDiv.innerHTML = renderQuestCategory('Scholar');

    // Study Records — 主界面只显示当天记录（过往记录请看 Records / Timeline）
    const todayStudyRecords = state.studyRecords.filter(r => r.date === todayStr);
    const studyEl = document.getElementById('studyRecordList');
    studyEl.innerHTML = todayStudyRecords.length === 0
        ? '<div style="color:var(--text-secondary); font-size:var(--fs-small);">No study records today.</div>'
        : todayStudyRecords.map(r => `
            <div class="record-item">
                <div class="record-main">
                    <span style="font-weight:600;">${escapeHtml(r.desc)}</span>
                    <span style="color:var(--text-secondary); font-size:var(--fs-xsmall);">
                        <span class="record-time ${getTimeClass(r.time)}">[${escapeHtml(r.time)}]</span> ${r.mins}m · +${r.charXP} XP
                    </span>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn-tertiary" onclick="openEditModal('focus', '${r.id}')" title="Edit">✏️</button>
                    <button class="btn-tertiary" style="color:var(--red-error);" onclick="deleteStudyRecord('${r.id}')" title="Delete">✖</button>
                </div>
            </div>
        `).join('');

    // Wallet Ledger — 主界面只显示当天流水
    const ledgerDateEl = document.getElementById('ledgerDateTag');
    if (ledgerDateEl) ledgerDateEl.textContent = todayStr;
    const todayTransactions = state.transactions.filter(t => t.date === todayStr);
    const ledgerEl = document.getElementById('ledgerList');
    ledgerEl.innerHTML = todayTransactions.length === 0
        ? '<div style="color:var(--text-secondary); font-size:var(--fs-small);">No transactions today.</div>'
        : todayTransactions.map(t => {
            const isEarn = t.type === 'earn';
            const sign = isEarn ? '+' : '-';
            const amtFormatted = t.amount % 1 !== 0 ? t.amount.toFixed(1) : t.amount;
            let actions = '';
            if (t.type === 'spend') {
                actions = `<button class="btn-tertiary" onclick="openEditModal('spend', '${t.id}')" title="Edit">✏️</button>
                           <button class="btn-tertiary" style="color:var(--red-error);" onclick="promptDeleteExpense('${t.id}')" title="Delete">✖</button>`;
            } else if (t.linkedId === 'bb') {
                actions = `<button class="btn-tertiary" style="color:var(--red-error);" onclick="undoBlindBox('${t.id}')" title="Undo">✖</button>`;
            } else if (t.linkedQuestId) {
                actions = `<button class="btn-tertiary" onclick="openEditModal('quest', '${t.id}')" title="Edit Time">✏️</button>
                           <button class="btn-tertiary" style="color:var(--red-error);" onclick="deleteQuestFromLedger('${t.id}')" title="Undo">✖</button>`;
            } else if (t.linkedTodoId) {
                actions = `<button class="btn-tertiary" style="color:var(--red-error);" onclick="undoTodoRewardFromLedger('${t.id}')" title="Undo">✖</button>`;
            }
            return `
                <div class="record-item">
                    <div class="record-main">
                        <span><span class="record-time ${getTimeClass(t.time)}">[${escapeHtml(t.time)}]</span> ${escapeHtml(t.desc)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                        <span class="${isEarn ? 'green-text' : 'red-text'} mono-num" style="font-weight:600;">${sign}${amtFormatted}</span>
                        ${actions}
                    </div>
                </div>
            `;
        }).join('');


    // Collapsed header quick summaries (Wallet, Character, Focus Goal)
    const charCollapsedEl = document.getElementById('charCollapsedSummary');
    if (charCollapsedEl) charCollapsedEl.textContent = `Lv.${level} · ${roundNum(state.charXP)} XP`;

    const focusCollapsedEl = document.getElementById('focusGoalCollapsedSummary');
    if (focusCollapsedEl) focusCollapsedEl.textContent = `${focusHours}h ${focusMins}m (${Math.round(basePct)}%)`;

    const walletSelectEl = document.getElementById('walletMetricSelect');
    const walletMetric = state.settings.walletCollapsedMetric || 'earning';
    if (walletSelectEl && walletSelectEl.value !== walletMetric) {
        walletSelectEl.value = walletMetric;
    }
    const walletSumEl = document.getElementById('walletCollapsedSummary');
    if (walletSumEl) {
        let extraText = '';
        if (walletMetric === 'spent') {
            extraText = ` · Spent -${state.spentToday.toFixed(1)}`;
        } else if (walletMetric === 'earning') {
            extraText = ` · Earned +${state.todayEarnings.toFixed(1)}`;
        } else if (walletMetric === 'month') {
            extraText = ` · Month ${state.monthEarnings.toFixed(1)}`;
        }
        walletSumEl.textContent = `${state.walletBalance.toFixed(2)} HK$${extraText}`;
    }

    if (typeof applyLayoutPreferences === 'function') {
        applyLayoutPreferences();
    }

    // Blind Box History (Today)
    const bbEl = document.getElementById('blindBoxList');
    bbEl.innerHTML = state.todayDetails.blindBoxes.length === 0
        ? '<div style="color:var(--text-secondary); font-size:var(--fs-small);">No draws today.</div>'
        : [...state.todayDetails.blindBoxes].reverse().map(b => `<div class="record-item">${escapeHtml(b)}</div>`).join('');
}

/* --- Daily Records Modal --- */
function toggleDetails(id) {
    const el = document.getElementById('details_' + id);
    el.style.display = (el.style.display === 'table-row') ? 'none' : 'table-row';
}

function formatQuestList(questsArray) {
    if (!questsArray || questsArray.length === 0) return 'None';
    const counts = {};
    questsArray.forEach(q => {
        const key = typeof q === 'string' ? q : q.desc;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([name, c]) => `<div class="quest-detail-line">${escapeHtml(name.replace(/^Quest:\s*/, ''))} (×${c})</div>`)
        .join('');
}

function openDailyLog() {
    const tbody = document.getElementById('dailyLogTableBody');
    tbody.innerHTML = '';

    const todayStr = getLocalDateString();
    const todayQuestsCount = Object.values(state.questCounts).reduce((a, b) => a + b, 0);
    const todayTodos = state.todos.filter(t => t.done).map(t => escapeHtml(t.text)).join(', ') || 'None';
    const todayFocusList = state.studyRecords.filter(r => r.date === todayStr).map(r => `${escapeHtml(r.desc)} (${r.mins}m)`).join(', ') || 'None';
    const todayTexts = state.todayDetails.texts.map(t => `[${escapeHtml(t.time)}] ${escapeHtml(t.desc)}`).join('<br>') || 'None';

    tbody.innerHTML += `
        <tr class="today-row" style="cursor:pointer;" onclick="toggleDetails('today')">
            <td class="teal-text">Today (${todayStr})</td>
            <td class="mono-num">${state.focusTimeToday}</td>
            <td class="mono-num">${todayQuestsCount}</td>
            <td class="gold-text mono-num">${state.todayEarnings.toFixed(1)}</td>
            <td class="red-text mono-num">${state.spentToday.toFixed(1)}</td>
            <td>▼</td>
        </tr>
        <tr id="details_today" class="details-row">
            <td colspan="6">
                <div class="details-content">
                    <strong>To-Dos Completed:</strong> ${todayTodos}<br>
                    <strong>Focus Sessions:</strong> ${todayFocusList}<br>
                    <strong>Quests Breakdown:</strong>${formatQuestList(state.todayDetails.quests)}
                    <strong>Blind Boxes:</strong> ${state.todayDetails.blindBoxes.map(escapeHtml).join(', ') || 'None'}<br>
                    <strong>Timestamps:</strong><br>${todayTexts}
                </div>
            </td>
        </tr>
    `;

    state.dailyHistory.forEach((day, idx) => {
        const details = day.details || { todosCompleted: [], studyRecords: [], quests: [], blindBoxes: [], texts: [] };
        const histFocus = (details.studyRecords || []).map(r => typeof r === 'string' ? escapeHtml(r) : `${escapeHtml(r.desc)} (${r.mins}m)`).join(', ') || 'None';
        const histTexts = (details.texts || []).map(t => `[${escapeHtml(t.time)}] ${escapeHtml(t.desc)}`).join('<br>') || 'None';

        tbody.innerHTML += `
            <tr style="cursor:pointer;" onclick="toggleDetails('hist_${idx}')">
                <td class="mono-num">${escapeHtml(day.date)}</td>
                <td class="mono-num">${day.focus}</td>
                <td class="mono-num">${day.quests}</td>
                <td class="gold-text mono-num">${Number(day.earned).toFixed(1)}</td>
                <td class="red-text mono-num">${Number(day.spent).toFixed(1)}</td>
                <td>▼</td>
            </tr>
            <tr id="details_hist_${idx}" class="details-row">
                <td colspan="6">
                    <div class="details-content">
                        <strong>To-Dos:</strong> ${(details.todosCompleted || []).map(escapeHtml).join(', ') || 'None'}<br>
                        <strong>Focus Sessions:</strong> ${histFocus}<br>
                        <strong>Quests Breakdown:</strong>${formatQuestList(details.quests)}
                        <strong>Blind Boxes:</strong> ${(details.blindBoxes || []).map(escapeHtml).join(', ') || 'None'}<br>
                        <strong>Timestamps:</strong><br>${histTexts}
                    </div>
                </td>
            </tr>
        `;
    });

    document.getElementById('dailyLogModal').style.display = 'block';
}

function closeDailyLog() {
    document.getElementById('dailyLogModal').style.display = 'none';
}

/* --- 7-Day Timeline --- */
function renderTimeline() {
    const container = document.getElementById('timelineContent');
    container.innerHTML = '';

    const daysToRender = [{
        date: getLocalDateString(),
        label: `Today (${getLocalDateString()})`,
        focusRecords: state.studyRecords.filter(r => r.date === getLocalDateString()),
        texts: [...state.todayDetails.texts]
    }];

    for (let i = 0; i < Math.min(6, state.dailyHistory.length); i++) {
        const histDay = state.dailyHistory[i];
        const hDetails = histDay.details || {};
        const focusRecs = (hDetails.studyRecords || []).map(r => {
            if (typeof r === 'object') return r;
            const match = String(r).match(/(.+) \((\d+)m\)/);
            return match ? { desc: match[1], mins: parseInt(match[2], 10), time: '12:00' } : { desc: r, mins: 30, time: '12:00' };
        });
        daysToRender.push({
            date: histDay.date,
            label: histDay.date,
            focusRecords: focusRecs,
            texts: hDetails.texts || []
        });
    }

    daysToRender.forEach(day => {
        let barHtml = '';
        let listHtml = '';

        const sortedFocus = [...day.focusRecords].sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
        const sortedTexts = [...day.texts].sort((a, b) => timeToMins(a.time) - timeToMins(b.time));

        sortedFocus.forEach(rec => {
            let startMins = timeToMins(rec.time);
            if (startMins < 0) startMins = 12 * 60;
            const leftPct = (startMins / 1440) * 100;
            const widthPct = (Math.max(5, rec.mins) / 1440) * 100;
            barHtml += `<div class="timeline-block" style="left:${leftPct}%; width:${widthPct}%;" title="${escapeHtml(rec.desc)} (${rec.mins}m)"></div>`;
            listHtml += `<li><span class="record-time ${getTimeClass(rec.time)}">${escapeHtml(rec.time)}</span> <span class="gold-text">[Focus]</span> <span>${escapeHtml(rec.desc)} (${rec.mins}m)</span></li>`;
        });

        sortedTexts.forEach(txt => {
            const mins = timeToMins(txt.time);
            if (mins >= 0) {
                const leftPct = (mins / 1440) * 100;
                barHtml += `<div class="timeline-block" style="left:${leftPct}%; width:6px; background-color:var(--teal-action); border-radius:50%; top:-2px; height:112%;" title="${escapeHtml(txt.desc)}"></div>`;
            }
            listHtml += `<li><span class="record-time ${getTimeClass(txt.time)}">${escapeHtml(txt.time)}</span> <span class="teal-text">[Log]</span> <span>${escapeHtml(txt.desc)}</span></li>`;
        });

        if (!listHtml) listHtml = '<li style="color:var(--text-secondary); border:none;">No timeline events recorded.</li>';

        container.innerHTML += `
            <div class="timeline-day">
                <div class="timeline-header">${escapeHtml(day.label)}</div>
                <div class="timeline-bar-container">
                    ${barHtml}
                    <div class="timeline-labels">
                        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
                    </div>
                </div>
                <ul class="timeline-list">${listHtml}</ul>
            </div>
        `;
    });
}
