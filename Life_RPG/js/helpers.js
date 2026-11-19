/* =======================================================================
   HELPERS.JS — 通用工具函数、Toast 提示与烟花特效
   ======================================================================= */

function roundNum(num) {
    return Math.round(num * 100) / 100;
}

function generateId() {
    return Date.now().toString() + Math.floor(Math.random() * 10000);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLocalMonthString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getFormattedTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMins(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return -1;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function getTimeClass(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 'time-night';
    const h = parseInt(timeStr.split(':')[0], 10);
    if (h >= 8 && h < 12) return 'time-morning';
    if (h >= 12 && h < 18) return 'time-afternoon';
    if (h >= 18 && h <= 23) return 'time-evening';
    return 'time-night';
}

function calculateLevel(xp) {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 10)) + 1;
}

function setDailyQuote() {
    const now = new Date();
    const diff = now - new Date(now.getFullYear(), 0, 0);
    const el = document.getElementById('dailyQuote');
    if (el) {
        el.innerText = QUOTES[Math.floor(diff / (1000 * 60 * 60 * 24)) % QUOTES.length];
    }
}

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 2800);
}

/* --- Confetti Canvas --- */
let cCanvas = null;
let cCtx = null;
let cParticles = [];
let cAnimating = false;

function initConfettiCanvas() {
    cCanvas = document.getElementById('confetti-canvas');
    if (!cCanvas) return;
    cCtx = cCanvas.getContext('2d');
    const resizeCanvas = () => {
        cCanvas.width = window.innerWidth;
        cCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function fireConfetti(x, y) {
    if (!cCanvas || !cCtx) return;
    const originX = (typeof x === 'number' && x > 0) ? x : window.innerWidth / 2;
    const originY = (typeof y === 'number' && y > 0) ? y : window.innerHeight / 2;
    const colors = ['#d2a84a', '#2f81f7', '#56d364', '#a371f7', '#e3b341'];
    for (let i = 0; i < 42; i++) {
        cParticles.push({
            x: originX, y: originY,
            vx: (Math.random() - 0.5) * 11,
            vy: (Math.random() - 1) * 11 - 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 4.5 + 2.5,
            life: 1,
            decay: Math.random() * 0.02 + 0.014
        });
    }
    if (!cAnimating) animateConfetti();
}

function animateConfetti() {
    cAnimating = true;
    cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
    for (let i = 0; i < cParticles.length; i++) {
        const p = cParticles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.life -= p.decay;
        cCtx.globalAlpha = Math.max(0, p.life);
        cCtx.fillStyle = p.color;
        cCtx.beginPath();
        cCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        cCtx.fill();
    }
    cParticles = cParticles.filter(p => p.life > 0);
    if (cParticles.length > 0) requestAnimationFrame(animateConfetti);
    else { cAnimating = false; cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height); }
}
