/* =======================================================================
   ACTIONS.JS — Quests、To-Do（固定/盲盒）、支出、盲盒与通用编辑弹窗
   ======================================================================= */

function rollBlindBoxAmount() {
    const rand = Math.random();
    if (rand > 0.99) return 8.0;
    if (rand > 0.97) return 6.0;
    if (rand > 0.94) return 5.0;
    if (rand > 0.85) return 3.0;
    if (rand > 0.70) return 1.0;
    if (rand > 0.40) return 0.8;
    return 0.6;
}

function awardCappedWalletXP(requestedAmt) {
    const availDaily = Math.max(0, state.settings.dailyCap - state.todayEarnings);
    const availMonthly = Math.max(0, state.settings.monthlyCap - state.monthEarnings);
    const actual = roundNum(Math.min(requestedAmt, availDaily, availMonthly));
    if (actual > 0) {
        state.todayEarnings = roundNum(state.todayEarnings + actual);
        state.monthEarnings = roundNum(state.monthEarnings + actual);
    }
    return actual;
}

function pushTransaction(tx) {
    if (!tx.date) tx.date = getLocalDateString();
    state.transactions.unshift(tx);
    state.transactions.sort((a, b) => b.time.localeCompare(a.time));
    if (state.transactions.length > 80) state.transactions = state.transactions.slice(0, 80);
}

/* --- Daily Quests --- */
function claimQuest(questId, e) {
    checkDayRollover(true);
    const quest = state.settings.quests.find(q => q.id === questId);
    if (!quest) return;
    const counts = getTodayQuestCounts();
    const currentCount = counts[questId] || 0;
    if (currentCount >= quest.limit) return;

    let inputDesc = '';
    let recordedTime = getFormattedTime();
    if (quest.hasInput) {
        const userInput = prompt(`Enter details for "${quest.name}" (e.g. 07:30 or note):`);
        if (userInput === null || userInput.trim() === '') return;
        const inputRaw = userInput.trim();
        const timeMatch = inputRaw.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) recordedTime = timeMatch[1].padStart(5, '0');
        inputDesc = ` (${inputRaw})`;
        state.todayDetails.texts.push({
            time: recordedTime,
            desc: quest.name + (timeMatch ? '' : ` (${inputRaw})`)
        });
    }

    state.charXP = roundNum(state.charXP + quest.xp);
    const walletAward = awardCappedWalletXP(quest.xp);
    const fullDesc = `Quest: ${quest.name}${inputDesc}`;
    const txId = generateId();

    pushTransaction({
        id: txId,
        date: getLocalDateString(),
        time: recordedTime,
        desc: fullDesc,
        amount: walletAward,
        type: 'earn',
        linkedQuestId: questId
    });

    state.todayDetails.quests.push({ id: txId, qId: questId, desc: fullDesc, time: recordedTime });
    counts[questId] = currentCount + 1;

    if (e && e.clientX) fireConfetti(e.clientX, e.clientY);
    showToast(`${quest.icon || '✨'} ${quest.name}: +${walletAward} HK$ · +${quest.xp} XP`);
    saveState();
}

function deleteQuestFromLedger(txId) {
    const txIdx = state.transactions.findIndex(t => t.id === txId);
    if (txIdx === -1) return;
    const tx = state.transactions[txIdx];
    const quest = state.settings.quests.find(q => q.id === tx.linkedQuestId);
    const qName = quest ? quest.name : tx.desc;

    if (!confirm(`Delete log for [${qName}]?\nThis will revert its XP and Wallet reward.`)) return;

    const qDetailIdx = state.todayDetails.quests.findIndex(q => q.id === txId);
    if (qDetailIdx >= 0) state.todayDetails.quests.splice(qDetailIdx, 1);

    if (quest) {
        const textIdx = state.todayDetails.texts.findIndex(t => t.desc.startsWith(quest.name) && t.time === tx.time);
        if (textIdx >= 0) state.todayDetails.texts.splice(textIdx, 1);
        state.charXP = Math.max(0, roundNum(state.charXP - quest.xp));
    }

    state.todayEarnings = Math.max(0, roundNum(state.todayEarnings - tx.amount));
    state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - tx.amount));
    const counts = getTodayQuestCounts();
    if (tx.linkedQuestId && counts[tx.linkedQuestId] > 0) {
        counts[tx.linkedQuestId]--;
    }

    state.transactions.splice(txIdx, 1);
    saveState();
}

/* --- Blind Box --- */
function drawBlindBox(e) {
    checkDayRollover(true);
    const desc = document.getElementById('bbDesc').value.trim();
    if (!desc) return alert('Please enter the challenge you completed!');
    const before = document.getElementById('bbBefore').value.trim();
    const after = document.getElementById('bbAfter').value.trim();

    const rawReward = rollBlindBoxAmount();
    const reward = awardCappedWalletXP(rawReward);
    state.charXP = roundNum(state.charXP + 1);

    const logDesc = `Blind Box: ${desc}${before || after ? ` [${before || '-'} → ${after || '-'}]` : ''}`;
    pushTransaction({
        id: generateId(),
        date: getLocalDateString(),
        time: getFormattedTime(),
        desc: logDesc,
        amount: reward,
        type: 'earn',
        linkedId: 'bb'
    });
    state.todayDetails.blindBoxes.push(`${logDesc} (+${reward} HK$)`);

    document.getElementById('bbDesc').value = '';
    document.getElementById('bbBefore').value = '';
    document.getElementById('bbAfter').value = '';

    if (e && e.clientX) fireConfetti(e.clientX, e.clientY);
    showToast(`🎁 Blind Box: +${reward} HK$! (${desc})`);
    saveState();
}

function undoBlindBox(txId) {
    const txIndex = state.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;
    const tx = state.transactions[txIndex];

    if (!confirm(`Cancel Blind Box reward [${tx.desc}] of ${tx.amount} HK$?`)) return;
    state.todayEarnings = Math.max(0, roundNum(state.todayEarnings - tx.amount));
    state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - tx.amount));
    state.charXP = Math.max(0, roundNum(state.charXP - 1));

    const bbIdx = state.todayDetails.blindBoxes.findIndex(b => b.startsWith(tx.desc));
    if (bbIdx >= 0) state.todayDetails.blindBoxes.splice(bbIdx, 1);
    state.transactions.splice(txIndex, 1);
    saveState();
}

/* --- Expenses --- */
function recordExpense() {
    checkDayRollover(true);
    const descInput = document.getElementById('expDesc');
    const amtInput = document.getElementById('expAmt');
    const desc = descInput.value.trim() || 'Uncategorized Expense';
    const amount = roundNum(parseFloat(amtInput.value));

    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid amount.');
    if (!confirm(`Record expense [${desc}] for ${amount} HK$?\nWallet Balance: ${state.walletBalance.toFixed(2)} → ${(state.walletBalance - amount).toFixed(2)} HK$`)) return;

    state.walletBalance = roundNum(state.walletBalance - amount);
    state.spentToday = roundNum(state.spentToday + amount);
    pushTransaction({
        id: generateId(),
        date: getLocalDateString(),
        time: getFormattedTime(),
        desc: `Spent: ${desc}`,
        amount,
        type: 'spend'
    });
    descInput.value = '';
    amtInput.value = '';
    saveState();
}

function promptDeleteExpense(txId) {
    const txIndex = state.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) return;
    const tx = state.transactions[txIndex];
    if (!confirm(`Delete expense [${tx.desc}] of ${tx.amount} HK$?\nWallet Balance: ${state.walletBalance.toFixed(2)} → ${(state.walletBalance + tx.amount).toFixed(2)} HK$`)) return;

    state.walletBalance = roundNum(state.walletBalance + tx.amount);
    state.spentToday = Math.max(0, roundNum(state.spentToday - tx.amount));
    state.transactions.splice(txIndex, 1);
    saveState();
}

/* --- To-Do List --- */
function sortTodos() {
    if (state.todoCustomOrder) return;
    state.todos.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.text.localeCompare(b.text);
    });
}

function autoSortTodos() {
    state.todoCustomOrder = false;
    sortTodos();
    saveState();
}

function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();
    if (!text) return;
    state.todos.unshift({ id: generateId(), text, done: false });
    sortTodos();
    input.value = '';
    saveState();
}

function toggleTodo(id, e) {
    checkDayRollover(true);
    const todo = state.todos.find(t => t.id === id);
    if (!todo) return;

    todo.done = !todo.done;
    state.todos = state.todos.filter(t => t.id !== id);

    if (todo.done) {
        state.todos.push(todo);

        const mode = state.settings.todoRewardMode || 'fixed';
        const rawReward = (mode === 'blindbox')
            ? rollBlindBoxAmount()
            : roundNum(Number(state.settings.todoRewardAmount ?? 1));

        const actualReward = awardCappedWalletXP(rawReward);
        const charXPAward = 1;
        state.charXP = roundNum(state.charXP + charXPAward);

        const txId = generateId();
        const prefix = (mode === 'blindbox') ? 'To-Do 🎁' : 'To-Do';
        if (actualReward > 0 || rawReward > 0) {
            pushTransaction({
                id: txId,
                date: getLocalDateString(),
                time: getFormattedTime(),
                desc: `${prefix}: ${todo.text}`,
                amount: actualReward,
                type: 'earn',
                linkedTodoId: todo.id
            });
            todo.rewardTxId = txId;
        }
        todo.awardedAmount = actualReward;
        todo.awardedCharXP = charXPAward;

        if (e) fireConfetti(e.clientX, e.clientY);
        if (mode === 'blindbox') {
            showToast(`🎁 To-Do Blind Box: +${actualReward} HK$!`);
        } else if (actualReward > 0) {
            showToast(`✅ Task Done: +${actualReward} HK$`);
        } else {
            showToast(`✅ Task Done (+1 XP)`);
        }
    } else {
        state.todos.unshift(todo);
        if (todo.awardedAmount) {
            state.todayEarnings = Math.max(0, roundNum(state.todayEarnings - todo.awardedAmount));
            state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - todo.awardedAmount));
        }
        if (todo.awardedCharXP) {
            state.charXP = Math.max(0, roundNum(state.charXP - todo.awardedCharXP));
        }
        if (todo.rewardTxId) {
            state.transactions = state.transactions.filter(t => t.id !== todo.rewardTxId);
        }
        delete todo.rewardTxId;
        delete todo.awardedAmount;
        delete todo.awardedCharXP;
    }

    sortTodos();
    saveState();
}

function undoTodoRewardFromLedger(txId) {
    const txIdx = state.transactions.findIndex(t => t.id === txId);
    if (txIdx === -1) return;
    const tx = state.transactions[txIdx];
    if (!confirm(`Revert To-Do reward [${tx.desc}] of +${tx.amount} HK$?`)) return;

    state.todayEarnings = Math.max(0, roundNum(state.todayEarnings - tx.amount));
    state.monthEarnings = Math.max(0, roundNum(state.monthEarnings - tx.amount));
    state.charXP = Math.max(0, roundNum(state.charXP - 1));

    const todo = state.todos.find(t => t.rewardTxId === txId);
    if (todo) {
        todo.done = false;
        delete todo.rewardTxId;
        delete todo.awardedAmount;
        delete todo.awardedCharXP;
    }
    state.transactions.splice(txIdx, 1);
    sortTodos();
    saveState();
}

function updateTodoText(id, newText) {
    const todo = state.todos.find(t => t.id === id);
    if (todo && newText.trim() !== '') {
        todo.text = newText.trim();
        sortTodos();
        saveState();
    }
}

function deleteTodo(id) {
    state.todos = state.todos.filter(t => t.id !== id);
    saveState();
}

let draggedTodoId = null;
function handleDragStart(e, id) {
    draggedTodoId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setTimeout(() => { if (e.target.closest) e.target.closest('.todo-item')?.classList.add('dragging'); }, 0);
}
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function handleDrop(e, targetId) {
    e.preventDefault();
    if (!draggedTodoId || draggedTodoId === targetId) return;
    const oldIdx = state.todos.findIndex(t => t.id === draggedTodoId);
    const newIdx = state.todos.findIndex(t => t.id === targetId);
    if (oldIdx !== -1 && newIdx !== -1) {
        const [moved] = state.todos.splice(oldIdx, 1);
        state.todos.splice(newIdx, 0, moved);
        state.todoCustomOrder = true;
        saveState();
    }
}
function handleDragEnd(e) {
    if (e.target.closest) e.target.closest('.todo-item')?.classList.remove('dragging');
    draggedTodoId = null;
}

/* --- Universal Edit Modal --- */
function openEditModal(type, id) {
    document.getElementById('editType').value = type;
    document.getElementById('editId').value = id;

    const descGrp = document.getElementById('editDescGroup');
    const amtGrp = document.getElementById('editAmtGroup');

    if (type === 'spend') {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;
        document.getElementById('editModalTitle').innerText = 'Edit Expense';
        document.getElementById('editDesc').value = tx.desc.replace(/^Spent:\s*/, '');
        document.getElementById('editAmtLabel').innerText = 'Amount HK$:';
        document.getElementById('editAmt').value = tx.amount;
        document.getElementById('editTime').value = tx.time;
        descGrp.style.display = 'flex';
        amtGrp.style.display = 'flex';
    } else if (type === 'focus') {
        const rec = state.studyRecords.find(r => r.id === id);
        if (!rec) return;
        document.getElementById('editModalTitle').innerText = 'Edit Focus Record';
        document.getElementById('editDesc').value = rec.desc;
        document.getElementById('editAmtLabel').innerText = 'Minutes:';
        document.getElementById('editAmt').value = rec.mins;
        document.getElementById('editTime').value = rec.time;
        descGrp.style.display = 'flex';
        amtGrp.style.display = 'flex';
    } else if (type === 'quest') {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;
        document.getElementById('editModalTitle').innerText = 'Edit Quest Time';
        document.getElementById('editTime').value = tx.time;
        document.getElementById('editLinkedQuestId').value = tx.linkedQuestId;
        descGrp.style.display = 'none';
        amtGrp.style.display = 'none';
    }
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEditModal() {
    const type = document.getElementById('editType').value;
    const id = document.getElementById('editId').value;
    const time = document.getElementById('editTime').value.trim();
    if (!time) return alert('Time cannot be empty.');

    if (type === 'spend') {
        const desc = document.getElementById('editDesc').value.trim();
        const amt = roundNum(parseFloat(document.getElementById('editAmt').value));
        if (!desc || isNaN(amt) || amt < 0) return alert('Please fill all fields correctly.');

        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;
        const diff = roundNum(tx.amount - amt);
        if (!confirm(`Update expense to [${desc}], ${amt} HK$ at ${time}?\nWallet Balance adjusts by ${diff >= 0 ? '+' + diff : diff}.`)) return;

        state.walletBalance = roundNum(state.walletBalance + diff);
        state.spentToday = Math.max(0, roundNum(state.spentToday - diff));
        tx.desc = `Spent: ${desc}`;
        tx.amount = amt;
        tx.time = time;
    } else if (type === 'focus') {
        const desc = document.getElementById('editDesc').value.trim();
        const amt = parseInt(document.getElementById('editAmt').value, 10);
        if (!desc || isNaN(amt) || amt < 0) return alert('Please fill all fields correctly.');

        const rec = state.studyRecords.find(r => r.id === id);
        if (!rec) return;

        if (amt !== rec.mins) {
            const oldAward = rec.walletXP;
            const newRawAward = calculateFocusReward(amt);
            const diffAward = roundNum(newRawAward - oldAward);
            const diffXP = amt - rec.mins;

            if (!confirm(`Update minutes ${rec.mins} → ${amt}?\nChar XP: ${diffXP >= 0 ? '+' + diffXP : diffXP}\nWallet XP: ${diffAward >= 0 ? '+' + diffAward : diffAward}`)) return;

            state.todayEarnings = Math.max(0, Math.min(state.settings.dailyCap, roundNum(state.todayEarnings + diffAward)));
            state.monthEarnings = Math.max(0, Math.min(state.settings.monthlyCap, roundNum(state.monthEarnings + diffAward)));
            state.charXP = Math.max(0, roundNum(state.charXP + diffXP));
            state.focusTimeToday = Math.max(0, state.focusTimeToday + diffXP);

            rec.mins = amt;
            rec.walletXP = Math.max(0, roundNum(rec.walletXP + diffAward));
            rec.charXP = Math.max(0, rec.charXP + diffXP);

            const linkedTx = state.transactions.find(t => t.linkedId === id);
            if (linkedTx) {
                linkedTx.amount = rec.walletXP;
            } else if (rec.walletXP > 0) {
                pushTransaction({ id: generateId(), date: rec.date, time, desc: `Focus: ${desc} (${amt}m)`, amount: rec.walletXP, type: 'earn', linkedId: id });
            }
        }
        rec.desc = desc;
        rec.time = time;

        const linkedTx = state.transactions.find(t => t.linkedId === id);
        if (linkedTx) {
            linkedTx.desc = `Focus: ${desc} (${amt}m)`;
            linkedTx.time = time;
        }
    } else if (type === 'quest') {
        const tx = state.transactions.find(t => t.id === id);
        const qId = document.getElementById('editLinkedQuestId').value;
        if (!tx || !qId) return;

        tx.time = time;
        const qDetail = state.todayDetails.quests.find(q => q.id === id);
        if (qDetail) qDetail.time = time;
        const questDef = state.settings.quests.find(q => q.id === qId);
        if (questDef) {
            const textRec = state.todayDetails.texts.find(t => t.desc.startsWith(questDef.name));
            if (textRec) textRec.time = time;
        }
    }

    state.transactions.sort((a, b) => b.time.localeCompare(a.time));
    saveState();
    closeEditModal();
}


/* 手动刷新/清空今日 Daily Quests 面板计数（不影响余额与历史归档） */
function refreshDailyQuests() {
    if (!confirm('Reset today\'s Daily Quests completion counts?\n(Your wallet balance and history will not be affected.)')) return;
    const today = getLocalDateString();
    state.questCountsByDate = { [today]: {} };
    state.questCounts = state.questCountsByDate[today];
    state.questCountsDate = today;
    state.todayDetails.quests = [];
    // 同时清理账本里可能残留的旧日 Quest 记录
    state.transactions = state.transactions.filter(t => !(t.linkedQuestId && t.date !== today));
    saveState();
    showToast('↺ Daily Quests refreshed for today');
}

/* 手动清空 Wallet Ledger 当前列表显示（不影响余额、XP 和历史归档） */
function clearWalletLedgerView() {
    if (!confirm('Clear the current Wallet Ledger list?\n(Only clears the visible entries; balance, earnings, and history stay intact.)')) return;
    state.transactions = [];
    saveState();
    showToast('🧹 Wallet Ledger cleared');
}
