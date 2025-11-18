import * as Core from './core.js';
import * as AI from './ai.js';
import * as UI from './ui.js';

const State = {
    playerHP: 200,
    aiHP: 200,
    pDebt: 0,
    aiDebt: 0, 
    round: 1,
    deck: [],
    pool: [],
    pHand: [], 
    aiHand: [],
    judgeCard: null,
    rule: null,
    pDoubling: false,
    aiDoubling: false,
    phase: 'IDLE',
    firstMover: 'PLAYER'
};

window.startGame = async () => {
    document.getElementById('btn-start').classList.add('hidden');
    UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);
    startRound();
};

function updateRealTimeDashboard() {
    let pSum = 0;
    let aSum = 0;
    let rate = '?';
    let dmg = 0;

    if (State.phase === 'DEPLOY' || State.phase === 'BATTLE') {
        const aiArr = AI.optimizeHand(State.aiHand, State.rule);
        aSum = Core.calculateMixedSum([], aiArr, State.rule);
    } else {
        aSum = Core.calculateMixedSum(State.aiHand, [], null);
    }

    const slots = getPlayerSlots(); 
    let remainingHand = [...State.pHand];
    const placedValues = slots.filter(v => v !== null);
    for (let val of placedValues) {
        const idx = remainingHand.indexOf(val);
        if (idx > -1) remainingHand.splice(idx, 1);
    }

    if (State.phase === 'DEPLOY' || State.phase === 'BATTLE') {
        rate = Core.getJudgeMultiplier(State.judgeCard);
        pSum = Core.calculateMixedSum(remainingHand, slots, State.rule);
    } else {
        pSum = Core.calculateMixedSum(State.pHand, [], null);
        rate = State.judgeCard ? Core.getJudgeMultiplier(State.judgeCard) : '?';
    }
    
    if (rate === '?') {
        dmg = Math.abs(pSum - aSum) + ' (Raw)';
    } else {
        dmg = Math.abs(pSum - aSum) * rate;
    }

    UI.updateDashboard(pSum, aSum, rate, dmg);
}

function getPlayerSlots() {
    const arr = [null, null, null];
    for(let i=0; i<3; i++) {
        const s = document.getElementById(`lane-${i}`).querySelector('.player-slot');
        if (s.hasAttribute('data-val')) {
            arr[i] = parseInt(s.getAttribute('data-val'));
        }
    }
    return arr;
}

async function startRound() {
    UI.clearBattlefield();
    State.pHand = [];
    State.aiHand = [];
    State.pDoubling = false;
    State.aiDoubling = false;
    State.firstMover = State.round % 2 !== 0 ? 'PLAYER' : 'AI';
    
    UI.updateDashboard(0, 0, '?', 0);

    if (State.aiDebt > 0) {
        await UI.sleep(500);
        const action = AI.getDebtAction(State.aiHP, State.aiDebt);
        await UI.showAIDecision(action); 
        if (action === 'PAY') {
            const cost = Math.floor(State.aiDebt / 2);
            State.aiHP -= cost;
            State.aiDebt = 0;
            UI.notify(`AI 支付了 ${cost} 生命值`, 1000, 'orange');
        } else {
            State.aiDoubling = true;
        }
        UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);
    }

    if (State.pDebt > 0) {
        State.phase = 'DEBT';
        await UI.notify(`你的死缓池: ${State.pDebt}`, 1500, 'red');
        UI.showDebtOptions(true);
        return; 
    }

    proceedToDraft();
}

window.payDebt = async () => {
    const cost = Math.floor(State.pDebt / 2);
    State.playerHP -= cost;
    State.pDebt = 0;
    UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);
    UI.showDebtOptions(false);
    await UI.notify(`已认罪。扣除 ${cost}`, 1000, 'orange');
    proceedToDraft();
};

window.doubleDown = async () => {
    State.pDoubling = true;
    UI.showDebtOptions(false);
    await UI.notify('加注确认！风险 x1.5', 1000, 'red');
    proceedToDraft();
};

async function proceedToDraft() {
    State.phase = 'DRAFT';
    State.deck = Core.createDeck();
    State.pool = State.deck.slice(0, 7);
    
    const turnText = State.firstMover === 'PLAYER' ? '你的先手' : 'AI 先手';
    await UI.notify(`第 ${State.round} 回合 - ${turnText}`, 1500, State.firstMover === 'PLAYER' ? '#00f3ff' : '#ff2a6d');
    
    UI.renderDraftPool(State.pool, handlePlayerDraft);
    updateRealTimeDashboard(); 
    
    if (State.firstMover === 'AI') triggerAiDraft();
    else UI.setAIStatus('等待玩家先手...');
}

async function triggerAiDraft() {
    State.phase = 'AI_THINKING';
    UI.setAIStatus('AI 正在选牌...');
    UI.renderDraftPool(State.pool, null);
    
    await UI.sleep(600); 
    
    const aiPick = AI.getBestDraft(State.pool, State.aiHand, State.pHand);
    const aIdx = State.pool.indexOf(aiPick);
    
    if (aIdx > -1) {
        State.aiHand.push(aiPick);
        State.pool.splice(aIdx, 1);
        const cardName = aiPick === 1 ? 'A' : aiPick === 11 ? 'J' : aiPick === 12 ? 'Q' : aiPick === 13 ? 'K' : aiPick;
        UI.notify(`AI 拿走了 [ ${cardName} ]`, 800, 'magenta');
    }
    
    UI.renderHand('ai-hand-zone', State.aiHand, false);
    updateRealTimeDashboard();
    
    State.phase = 'DRAFT';
    
    if (State.pool.length === 1) endDraftPhase();
    else {
        UI.setAIStatus('轮到你了');
        UI.renderDraftPool(State.pool, handlePlayerDraft);
    }
}

async function handlePlayerDraft(val) {
    if (State.phase !== 'DRAFT') return;
    
    const pIdx = State.pool.indexOf(val);
    if (pIdx > -1) {
        State.pHand.push(val);
        State.pool.splice(pIdx, 1);
    }
    
    UI.renderHand('player-hand-zone', State.pHand);
    UI.renderDraftPool(State.pool, null); 
    updateRealTimeDashboard(); 
    
    if (State.pool.length === 1) {
        endDraftPhase();
        return;
    }
    await triggerAiDraft();
}

async function endDraftPhase() {
    State.judgeCard = State.pool[0];
    State.rule = Core.getJudgeRule(State.judgeCard);
    
    UI.renderDraftPool([], null); 
    await UI.revealJudge(State.judgeCard, State.rule);
    proceedToDeploy();
}

async function proceedToDeploy() {
    State.phase = 'DEPLOY';
    UI.setAIStatus('AI 已明牌');
    updateRealTimeDashboard(); 
    
    const pZone = document.getElementById('player-hand-zone');
    pZone.innerHTML = ''; 
    State.pHand.forEach(val => {
        const card = UI.createCardElement(val, 'player');
        card.onclick = () => selectCardToDeploy(card, val);
        pZone.appendChild(card);
    });
}

let selectedDeployCard = null;
function selectCardToDeploy(el, val) {
    if (State.phase !== 'DEPLOY') return;
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedDeployCard = { el, val };
}

window.placeCard = (laneIndex) => {
    if (!selectedDeployCard || State.phase !== 'DEPLOY') return;
    const lane = document.getElementById(`lane-${laneIndex}`);
    const slot = lane.querySelector('.player-slot');
    if (slot.hasAttribute('data-val')) return; 
    
    slot.innerHTML = '';
    slot.appendChild(UI.createCardElement(selectedDeployCard.val, 'player'));
    slot.setAttribute('data-val', selectedDeployCard.val);
    selectedDeployCard.el.remove();
    selectedDeployCard = null;
    updateRealTimeDashboard();
    
    checkDeployFull();
};

async function checkDeployFull() {
    const slots = document.querySelectorAll('.player-slot');
    let count = 0;
    const pArrangement = [];
    for(let i=0; i<3; i++) {
        const s = document.getElementById(`lane-${i}`).querySelector('.player-slot');
        if (s.hasAttribute('data-val')) {
            count++;
            pArrangement.push(parseInt(s.getAttribute('data-val')));
        }
    }
    
    if (count === 3) {
        updateRealTimeDashboard();
        State.phase = 'BATTLE';
        await UI.sleep(500);
        resolveBattle(pArrangement);
    }
}

// === 【核心修改】战斗结算逻辑 ===
async function resolveBattle(pArrangement) {
    UI.setAIStatus('开牌！');
    
    const aiArrangement = AI.optimizeHand(State.aiHand, State.rule);
    
    for (let i = 0; i < 3; i++) {
        const lane = document.getElementById(`lane-${i}`);
        const aiSlot = lane.querySelector('.ai-slot');
        aiSlot.innerHTML = '';
        aiSlot.appendChild(UI.createCardElement(aiArrangement[i], 'ai'));
    }
    
    await UI.sleep(1000);
    
    let pWins = 0;
    let aWins = 0;
    const modes = Core.getLaneModes(State.rule);
    
    const pTotal = Core.calculateMixedSum([], pArrangement, State.rule);
    const aTotal = Core.calculateMixedSum([], aiArrangement, State.rule);
    const multiplier = Core.getJudgeMultiplier(State.judgeCard);
    
    // 基础伤害
    let damage = Math.abs(pTotal - aTotal) * multiplier;
    
    // 逐路判定
    for (let i = 0; i < 3; i++) {
        const lane = document.getElementById(`lane-${i}`);
        const indicator = lane.querySelector('.rule-indicator');
        indicator.innerText = modes[i] === 'HIGH' ? '>' : '<';
        indicator.style.color = 'white';
        
        await UI.sleep(800);
        
        const winner = Core.compareLane(pArrangement[i], aiArrangement[i], modes[i]);
        if (winner === 'PLAYER') {
            pWins++;
            lane.style.borderColor = '#00f3ff';
            lane.style.boxShadow = '0 0 10px #00f3ff';
        } else if (winner === 'AI') {
            aWins++;
            lane.style.borderColor = '#ff2a6d';
            lane.style.boxShadow = '0 0 10px #ff2a6d';
        }
    }
    
    // === 【新增】三相碾压 (TRINITY CRUSH) 判定 ===
    let isPerfect = false;
    if (pWins === 3) {
        isPerfect = true;
        damage = damage * 2; // 伤害翻倍
        await UI.notify('⚡ 三相碾压！伤害翻倍！⚡', 2500, '#00f3ff');
    } else if (aWins === 3) {
        isPerfect = true;
        damage = damage * 2; // 伤害翻倍
        await UI.notify('💀 被碾压！承受双倍伤害！💀', 2500, '#ff2a6d');
    }

    // 更新最终显示的伤害值（包含暴击）
    UI.updateDashboard(pTotal, aTotal, multiplier + (isPerfect ? ' (CRIT)' : ''), damage);
    
    await UI.sleep(1500);
    
    if (pWins > aWins) {
        await UI.notify(`胜利！造成 ${damage} 伤害`, 2000, '#00f3ff');
        
        if (State.aiDoubling) {
            const realDmg = Math.floor(damage * 1.5); 
            State.aiHP -= realDmg;
             UI.notify(`AI 加注反噬！受到 ${realDmg} 伤害`, 2000, 'magenta');
        } else {
            State.aiDebt += damage; 
        }
        
        if (State.pDebt > 0) {
            await UI.notify('你的死缓池已清空！', 1500, '#ffd700');
            State.pDebt = 0;
        }
        
    } else {
        await UI.notify(`失败... 承受 ${damage} 点死缓`, 2000, '#ff2a6d');
        State.pDebt += damage;
        if (State.pDoubling) {
            State.pDebt = Math.floor(State.pDebt * 1.5);
            await UI.notify('加注惩罚：债务 x1.5', 1500, 'red');
        }
        
        if (State.aiDebt > 0) {
            State.aiDebt = 0;
        }
    }
    
    UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);
    
    if (State.pDebt >= 100) {
        await UI.sleep(1000);
        await UI.notify('玩家死刑执行！爆仓！', 3000, 'red');
        State.playerHP -= State.pDebt;
        State.pDebt = 0;
    }
    if (State.aiDebt >= 100) {
        await UI.sleep(1000);
        await UI.notify('AI 死刑执行！爆仓！', 3000, 'magenta');
        State.aiHP -= State.aiDebt;
        State.aiDebt = 0;
    }
    
    UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);

    if (State.playerHP <= 0) { UI.notify('GAME OVER', 99999, 'red'); return; }
    if (State.aiHP <= 0) { UI.notify('VICTORY', 99999, 'gold'); return; }
    
    State.round++;
    await UI.sleep(3000);
    
    document.querySelectorAll('.lane').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.boxShadow = 'none';
        l.querySelector('.rule-indicator').innerText = '?';
    });
    startRound();
}