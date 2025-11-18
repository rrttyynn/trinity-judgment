export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const els = {
    p2Hand: document.getElementById('p2-hand-zone'), // 适配 P2
    p1Hand: document.getElementById('p1-hand-zone'), // 适配 P1
    draftPool: document.getElementById('draft-pool'),
    judgeSlot: document.getElementById('judge-slot'),
    notification: document.getElementById('notification-layer'),
    // P2 Stats
    p2HP: document.getElementById('p2-hp-bar'),
    p2HPText: document.getElementById('p2-hp-text'),
    p2DebtVal: document.getElementById('p2-debt-val'),
    p2Status: document.getElementById('p2-status'),
    // P1 Stats
    p1HP: document.getElementById('p1-hp-bar'),
    p1HPText: document.getElementById('p1-hp-text'),
    p1DebtVal: document.getElementById('death-pool-value'),
    poolWarning: document.getElementById('pool-warning'),
    // Dashboard
    dashPanel: document.getElementById('dashboard-panel'),
    dashP1Sum: document.getElementById('dash-p1sum'),
    dashP2Sum: document.getElementById('dash-p2sum'),
    dashRate: document.getElementById('dash-rate'),
    dashDmg: document.getElementById('dash-dmg'),
    envHeat: document.getElementById('env-heat'),
    envJackpot: document.getElementById('env-jackpot'),
    // Hotseat Modal
    hotseatModal: document.getElementById('hotseat-modal'),
    hotseatTitle: document.getElementById('hotseat-title'),
    hotseatConfirmBtn: document.getElementById('btn-hotseat-confirm')
};

export function updateStats(p1Val, p2Val, p1Debt, p2Debt) {
    // P1 Stats
    els.p1HP.style.width = `${Math.max(0, (p1Val / 200) * 100)}%`;
    els.p1HPText.innerText = `${p1Val} / 200`;
    els.p1DebtVal.innerText = p1Debt;
    
    // P2 Stats
    els.p2HP.style.width = `${Math.max(0, (p2Val / 200) * 100)}%`;
    els.p2HPText.innerText = `${p2Val} / 200`;
    els.p2DebtVal.innerText = p2Debt;

    if (p1Debt >= 100) els.poolWarning.classList.remove('hidden');
    else els.poolWarning.classList.add('hidden');
}

export function updateDashboard(p1Sum, p2Sum, rate, dmg) {
    els.dashPanel.classList.remove('hidden');
    els.dashP1Sum.innerText = p1Sum;
    els.dashP2Sum.innerText = p2Sum === null ? '?' : p2Sum;
    els.dashRate.innerText = typeof rate === 'number' ? `x${rate}` : rate;
    els.dashDmg.innerText = dmg;
}

export function updateEnvironment(heat, jackpot) {
    els.envHeat.innerText = `Lv.${heat}`;
    els.envJackpot.innerText = jackpot;
    if (heat >= 3) els.envHeat.style.color = '#ff2a6d';
    else if (heat >= 2) els.envHeat.style.color = 'orange';
    else els.envHeat.style.color = 'lime';
}

export function setPlayerStatus(player, text) {
    const statusEl = player === 1 ? document.querySelector('.p1-hud .status-text') : els.p2Status;
    if (statusEl) statusEl.innerText = text;
}

export async function showHotseatModal(player) {
    const isP1 = player === 1;
    els.hotseatTitle.innerText = `PLAYER ${player}: YOUR TURN`;
    els.hotseatModal.classList.remove('hidden');
    // 隐藏当前的手牌，避免作弊
    document.getElementById(isP1 ? 'p2-hand-zone' : 'p1-hand-zone').classList.add('hidden');
    
    return new Promise(resolve => {
        const handler = () => {
            els.hotseatConfirmBtn.removeEventListener('click', handler);
            els.hotseatModal.classList.add('hidden');
            // 恢复手牌
            document.getElementById(isP1 ? 'p2-hand-zone' : 'p1-hand-zone').classList.remove('hidden');
            resolve();
        };
        els.hotseatConfirmBtn.addEventListener('click', handler);
    });
}

export function createCardElement(value, type = 'pool', isHidden = false) {
    const div = document.createElement('div');
    div.className = `card ${type}-card`;
    
    if (isHidden) {
        div.classList.add('back');
        div.innerText = '';
    } else {
        const displayVal = value === 1 ? 'A' : value === 11 ? 'J' : value === 12 ? 'Q' : value === 13 ? 'K' : value;
        div.innerText = displayVal;
        
        const corner = document.createElement('span');
        corner.className = 'card-corner';
        corner.innerText = value === 1 ? '1/14' : value;
        
        div.appendChild(corner);
    }
    
    div.dataset.value = value;
    return div;
}

export function renderDraftPool(poolCards, onCardClick) {
    els.draftPool.innerHTML = '';
    poolCards.forEach(value => {
        const card = createCardElement(value, 'pool');
        if (onCardClick) {
            card.onclick = () => onCardClick(value);
        }
        els.draftPool.appendChild(card);
    });
}

export function renderHand(zoneId, cards, isHidden = false) {
    const zone = document.getElementById(zoneId);
    zone.innerHTML = '';
    cards.forEach(value => {
        zone.appendChild(createCardElement(value, zoneId.includes('p2') ? 'p2' : 'p1', isHidden));
    });
}

export async function revealJudge(cardVal, rule) {
    document.getElementById('judge-slot').classList.remove('hidden');
    document.getElementById('judge-slot').innerHTML = '';
    const card = createCardElement(cardVal, 'judge');
    document.getElementById('judge-slot').appendChild(card);
    await notify(`规则: ${rule === 'YANG' ? '阳 (奇数)' : '阴 (偶数)'}`, 1500, rule === 'YANG' ? '#ffd700' : '#b1b1b1');
}

export function showDebtOptions(show, player) {
    const controls = document.getElementById('debt-actions');
    const playerControls = document.querySelector('.p1-hud .control-panel');
    const controlsActive = player === 1 ? true : false;
    
    if (show) {
        controls.classList.remove('hidden');
        playerControls.classList.add(controlsActive ? 'active-controls' : 'hidden');
    } else {
        controls.classList.add('hidden');
        playerControls.classList.remove('active-controls');
    }
}


export function clearBattlefield() {
    document.getElementById('draft-pool').innerHTML = '';
    document.getElementById('judge-slot').classList.add('hidden');
    updateDashboard(0, 0, '?', 0);
    document.getElementById('p2-hand-zone').innerHTML = '';
    document.getElementById('p1-hand-zone').innerHTML = '';
    document.querySelectorAll('.slot').forEach(s => {
        s.innerHTML = '';
        s.removeAttribute('data-value');
    });
    document.querySelectorAll('.lane-column').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.boxShadow = 'none';
        l.querySelector('.rule-icon').innerText = '?';
    });
}

export async function notify(text, duration = 2000, color = 'white') {
    document.getElementById('notification-layer').innerText = text;
    document.getElementById('notification-layer').style.color = color;
    document.getElementById('notification-layer').style.borderColor = color;
    document.getElementById('notification-layer').classList.remove('hidden');
    await sleep(duration);
    document.getElementById('notification-layer').classList.add('hidden');
}