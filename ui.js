export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const els = {
    aiHand: document.getElementById('ai-hand-zone'),
    playerHand: document.getElementById('player-hand-zone'),
    draftPool: document.getElementById('draft-pool'),
    judgeSlot: document.getElementById('judge-slot'),
    notification: document.getElementById('notification-layer'),
    aiHP: document.getElementById('ai-hp-bar'),
    aiHPText: document.getElementById('ai-hp-text'),
    pHP: document.getElementById('player-hp-bar'),
    pHPText: document.getElementById('player-hp-text'),
    deathPool: document.getElementById('death-pool-value'),
    aiDeathPool: document.getElementById('ai-debt-val'),
    poolWarning: document.getElementById('pool-warning'),
    debtActions: document.getElementById('debt-actions'),
    aiStatus: document.getElementById('ai-status'),
    aiModal: document.getElementById('ai-decision-modal'),
    aiDecisionText: document.getElementById('ai-decision-text'),
    dashPanel: document.getElementById('dashboard-panel'),
    dashPSum: document.getElementById('dash-psum'),
    dashASum: document.getElementById('dash-asum'),
    dashRate: document.getElementById('dash-rate'),
    dashDmg: document.getElementById('dash-dmg'),
    envHeat: document.getElementById('env-heat'),
    envJackpot: document.getElementById('env-jackpot')
};

export function updateStats(pVal, aVal, pDebt, aDebt) {
    els.pHP.style.width = `${Math.max(0, (pVal / 200) * 100)}%`;
    els.pHPText.innerText = `${pVal} / 200`;
    els.aiHP.style.width = `${Math.max(0, (aVal / 200) * 100)}%`;
    els.aiHPText.innerText = `${aVal} / 200`;
    els.deathPool.innerText = pDebt;
    els.aiDeathPool.innerText = aDebt;
    if (pDebt >= 100) els.poolWarning.classList.remove('hidden');
    else els.poolWarning.classList.add('hidden');
}

export function updateDashboard(pSum, aSum, rate, dmg) {
    els.dashPanel.classList.remove('hidden');
    els.dashPSum.innerText = pSum;
    els.dashASum.innerText = aSum === null ? '?' : aSum;
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

export function setAIStatus(text) {
    els.aiStatus.innerText = text;
}

export async function showAIDecision(action) {
    els.aiModal.classList.remove('hidden');
    els.aiDecisionText.innerText = "Thinking...";
    els.aiDecisionText.style.color = "#888";
    await sleep(600);
    if (action === 'DOUBLE') {
        els.aiDecisionText.innerText = "AI 选择：加注 (DOUBLE)";
        els.aiDecisionText.style.color = "#ff2a6d"; 
    } else {
        els.aiDecisionText.innerText = "AI 选择：认罪 (PAY)";
        els.aiDecisionText.style.color = "orange"; 
    }
    await sleep(1000);
    els.aiModal.classList.add('hidden');
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
        zone.appendChild(createCardElement(value, zoneId.includes('ai') ? 'ai' : 'player', isHidden));
    });
}

export async function revealJudge(cardVal, rule) {
    els.judgeSlot.classList.remove('hidden');
    els.judgeSlot.innerHTML = '';
    const card = createCardElement(cardVal, 'judge');
    els.judgeSlot.appendChild(card);
    await notify(`规则: ${rule === 'YANG' ? '阳 (奇数)' : '阴 (偶数)'}`, 1500, rule === 'YANG' ? '#ffd700' : '#b1b1b1');
}

export function showDebtOptions(show) {
    if (show) els.debtActions.classList.remove('hidden');
    else els.debtActions.classList.add('hidden');
}

export function clearBattlefield() {
    els.draftPool.innerHTML = '';
    els.judgeSlot.classList.add('hidden');
    updateDashboard(0, 0, '?', 0);
    els.aiHand.innerHTML = '';
    els.playerHand.innerHTML = '';
    document.querySelectorAll('.slot').forEach(s => {
        s.innerHTML = '';
        s.removeAttribute('data-value');
        s.removeAttribute('data-card'); 
    });
    document.querySelectorAll('.lane').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.boxShadow = 'none';
        l.querySelector('.rule-indicator').innerText = '?';
    });
}

export async function notify(text, duration = 2000, color = 'white') {
    els.notification.innerText = text;
    els.notification.style.color = color;
    els.notification.style.borderColor = color;
    els.notification.classList.remove('hidden');
    await sleep(duration);
    els.notification.classList.add('hidden');
}