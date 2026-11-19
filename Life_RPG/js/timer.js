/* =======================================================================
   TIMER.JS — 绝对时间专注计时器与 Study Records 管理
   ======================================================================= */

let timerInterval = null;

function startTimer() {
    checkDayRollover(true);
    if (state.timer.isRunning) return;
    state.timer.isRunning = true;
    state.timer.startTimestamp = Date.now();
    state.timer.desc = document.getElementById('focusDesc').value.trim();
    saveState();
    resumeAbsoluteTimer();
}

function resumeAbsoluteTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerUI, 1000);
    updateTimerUI();
}

function pauseTimer() {
    if (!state.timer.isRunning) return;
    clearInterval(timerInterval);
    const elapsedSeconds = Math.floor((Date.now() - state.timer.startTimestamp) / 1000);
    state.timer.accumulated += Math.max(0, elapsedSeconds);
    state.timer.isRunning = false;
    state.timer.startTimestamp = 0;
    saveState();
    updateTimerUI();
}

function finishTimer(e) {
    if (state.timer.isRunning) pauseTimer();
    const minutesFocused = Math.floor(state.timer.accumulated / 60);
    const desc = document.getElementById('focusDesc').value.trim() || state.timer.desc || 'Focus Session';

    if (minutesFocused >= 1) {
        const { actualWalletAward, charXPAward } = addStudyRecordObj(desc, minutesFocused);
        if (e) fireConfetti(window.innerWidth / 2, window.innerHeight / 2);
        showToast(`🎯 Focus Finished (${minutesFocused}m): +${actualWalletAward} HK$ · +${charXPAward} XP`);
    } else if (state.timer.accumulated > 0) {
        showToast('Session under 1 minute — timer reset.');
    }

    state.timer.accumulated = 0;
    state.timer.desc = '';
    document.getElementById('focusDesc').value = '';
    saveState();
    updateTimerUI();
}

function calculateFocusReward(mins) {
    if (mins >= state.settings.focusBlockMinutes) {
        return state.settings.focusBlockReward +
            Math.floor((mins - state.settings.focusBlockMinutes) / state.settings.extraFocusMinutes) * state.settings.extraFocusReward;
    }
    return mins >= 3 ? 3 : 0;
}

function addStudyRecordObj(desc, mins) {
    state.focusTimeToday += mins;
    const rawWallet = calculateFocusReward(mins);
    const actualWalletAward = awardCappedWalletXP(rawWallet);
    const charXPAward = mins;
    state.charXP = roundNum(state.charXP + charXPAward);

    const recId = generateId();
    const startObj = new Date(Date.now() - mins * 60000);
    const startTimeStr = `${String(startObj.getHours()).padStart(2, '0')}:${String(startObj.getMinutes()).padStart(2, '0')}`;
    const todayStr = getLocalDateString();

    if (actualWalletAward > 0) {
        pushTransaction({
            id: generateId(),
            date: todayStr,
            time: startTimeStr,
            desc: `Focus: ${desc} (${mins}m)`,
            amount: actualWalletAward,
            type: 'earn',
            linkedId: recId
        });
    }

    state.studyRecords.unshift({
        id: recId,
        desc,
        mins,
        charXP: charXPAward,
        walletXP: actualWalletAward,
        date: todayStr,
        time: startTimeStr
    });
    if (state.studyRecords.length > 100) state.studyRecords.pop();

    return { actualWalletAward, charXPAward };
}

function addManualStudyRecord() {
    checkDayRollover(true);
    const descInput = document.getElementById('manualStudyDesc');
    const minInput = document.getElementById('manualStudyMins');
    const desc = descInput.value.trim() || 'Manual Study Record';
    const mins = parseInt(minInput.value, 10);

    if (isNaN(mins) || mins <= 0) return alert('Please enter valid minutes.');
    if (!confirm(`Add study record [${desc}] for ${mins} mins?`)) return;

    const { actualWalletAward, charXPAward } = addStudyRecordObj(desc, mins);
    descInput.value = '';
    minInput.value = '';
    showToast(`📖 Logged ${mins}m: +${actualWalletAward} HK$ · +${charXPAward} XP`);
    saveState();
}

function deleteStudyRecord(id) {
    const idx = state.studyRecords.findIndex(r => r.id === id);
    if (idx === -1) return;
    const rec = state.studyRecords[idx];

    const newChar = Math.max(0, roundNum(state.charXP - rec.charXP));
    const newEarn = Math.max(0, roundNum(state.todayEarnings - rec.walletXP));
    if (!confirm(`Delete focus record [${rec.desc}] (${rec.mins}m)?\nChar XP: ${state.charXP} → ${newChar}\nToday Earnings: ${state.todayEarnings.toFixed(1)} → ${newEarn.toFixed(1)}`)) return;

    if (rec.date === getLocalDateString()) {
        state.focusTimeToday = Math.max(0, state.focusTimeToday - rec.mins);
        state.todayEarnings = newEarn;
    }
    state.charXP = newChar;
    state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - rec.walletXP));

    const txIdx = state.transactions.findIndex(t => t.linkedId === id);
    if (txIdx >= 0) state.transactions.splice(txIdx, 1);

    state.studyRecords.splice(idx, 1);
    saveState();
}

function formatTimer(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerUI() {
    let currentSeconds = state.timer.accumulated || 0;
    if (state.timer.isRunning && state.timer.startTimestamp > 0) {
        currentSeconds += Math.max(0, Math.floor((Date.now() - state.timer.startTimestamp) / 1000));
    }
    document.getElementById('timerDisplay').innerText = formatTimer(currentSeconds);

    const startBtn = document.getElementById('btnTimerStart');
    const resumeBtn = document.getElementById('btnTimerResume');
    const pauseBtn = document.getElementById('btnTimerPause');
    const finishBtn = document.getElementById('btnTimerFinish');
    const statusText = document.getElementById('focusStatusText');

    if (state.timer.isRunning) {
        startBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-flex';
        finishBtn.style.display = 'inline-flex';
        statusText.textContent = 'Deep Work · In Progress';
    } else if (currentSeconds > 0) {
        startBtn.style.display = 'none';
        resumeBtn.style.display = 'inline-flex';
        pauseBtn.style.display = 'none';
        finishBtn.style.display = 'inline-flex';
        statusText.textContent = 'Deep Work · Paused';
    } else {
        startBtn.style.display = 'inline-flex';
        resumeBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        finishBtn.style.display = 'none';
        statusText.textContent = 'Deep Work · Ready';
    }
}
