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
    firstMover: 'PLAYER',
    heat: 1,
    jackpot: 0,
    forcedSettle: false 
};

window.startGame = async () => {
    document.getElementById('btn-start').classList.add('hidden');
    updateGameState();
    startRound();
};

function updateGameState() {
    UI.updateStats(State.playerHP, State.aiHP, State.pDebt, State.aiDebt);
    UI.updateEnvironment(State.heat, State.jackpot);
}

function updateRealTimeDashboard() {
    let pSum = 0;
    let aSum = 0;
    let rate = '?';
    let dmg = '0';

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
        
        const baseDmg = Math.abs(pSum - aSum) * rate * State.heat;
        dmg = `${baseDmg}`;
        rate = `${rate}x${State.heat}`;
    } else {
        pSum = Core.calculateMixedSum(State.pHand, [], null);
        rate = State.judgeCard ? Core.getJudgeMultiplier(State.judgeCard) : '?';
        dmg = `${Math.abs(pSum - aSum)} (Raw)`;
    }

    UI.updateDashboard(pSum, aSum, rate, dmg);
}

function getPlayerSlots() {
    const arr = [null, null, null];
    for(let i=0; i<3; i++) {
        const s = document.getElementById(`lane-${i}`).querySelector('.player-slot');
        if (s.hasAttribute('data-value')) {
            arr[i] = parseInt(s.getAttribute('data-value'));
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
    State.forcedSettle = false; 
    State.firstMover = State.round % 2 !== 0 ? 'PLAYER' : 'AI';
    
    State.heat = Math.floor((State.round - 1) / 3) + 1;
    updateGameState();
    UI.updateDashboard(0, 0, '?', 0);

    // AI 死缓处理
    if (State.aiDebt > 0) {
        await UI.sleep(500);
        const action = AI.getDebtAction(State.aiHP, State.aiDebt, State.heat); 
        await UI.showAIDecision(action); 
        if (action === 'PAY') {
            const cost = Math.floor(State.aiDebt / 2);
            State.aiHP -= cost;
            State.aiDebt = 0;
            UI.notify(`AI 支付了 ${cost} 生命值`, 1000, 'orange');
        } else {
            State.aiDoubling = true;
        }
        updateGameState();
    }

    // 玩家死缓处理
    if (State.pDebt > 0) {
        State.phase = 'DEBT';
        let debtWarning = `死缓池: ${State.pDebt}`;
        if (State.pDebt > 100) {
            debtWarning += " ⚠ 高风险！加注失败将直接扣除生命！";
        }
        await UI.notify(debtWarning, 1500, State.pDebt > 100 ? 'red' : 'red');
        UI.showDebtOptions(true);
        return; 
    }
    proceedToDraft();
}

window.payDebt = async () => {
    const cost = Math.floor(State.pDebt / 2);
    State.playerHP -= cost;
    State.pDebt = 0;
    updateGameState();
    UI.showDebtOptions(false);
    await UI.notify(`已认罪。扣除 ${cost}`, 1000, 'orange');
    proceedToDraft();
};

window.doubleDown = async () => {
    State.pDoubling = true;
    UI.showDebtOptions(false);
    if (State.pDebt > 100) {
        await UI.notify('极限加注：输了直接扣血，赌上一切！', 1500, 'red');
    } else {
        await UI.notify('加注确认！风险 x1.5', 1000, 'red');
    }
    proceedToDraft();
};

async function proceedToDraft() {
    State.phase = 'DRAFT';
    State.deck = Core.createDeck();
    State.pool = State.deck.slice(0, 7);
    const turnText = State.firstMover === 'PLAYER' ? '你的先手' : 'AI 先手';
    await UI.notify(`Round ${State.round} [Heat x${State.heat}]`, 1500, '#ffd700');
    UI.renderDraftPool(State.pool, handlePlayerDraft);
    updateRealTimeDashboard(); 
    if (State.firstMover === 'AI') triggerAiDraft();
    else UI.setAIStatus('等待玩家先手...');
}

async function triggerAiDraft() {
    State.phase = 'AI_THINKING';
    UI.setAIStatus('AI 正在选牌...');
    UI.renderDraftPool(State.pool, null);
    await UI.sleep(500); 
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
    if (State.pool.length <= 1) endDraftPhase();
    else {
        UI.setAIStatus('轮到你了');
        UI.renderDraftPool(State.pool, handlePlayerDraft);
    }
}

async function handlePlayerDraft(value) {
    if (State.phase !== 'DRAFT') return;
    const pIdx = State.pool.indexOf(value);
    if (pIdx > -1) {
        State.pHand.push(value);
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
    State.pHand.forEach(value => {
        const card = UI.createCardElement(value, 'player');
        card.onclick = () => selectCardToDeploy(card, value);
        pZone.appendChild(card);
    });
}

let selectedDeployCard = null;
function selectCardToDeploy(el, value) {
    if (State.phase !== 'DEPLOY') return;
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedDeployCard = { el, value };
}

window.placeCard = (laneIndex) => {
    if (!selectedDeployCard || State.phase !== 'DEPLOY') return;
    const lane = document.getElementById(`lane-${laneIndex}`);
    const slot = lane.querySelector('.player-slot');
    if (slot.hasAttribute('data-value')) return; 
    
    slot.innerHTML = '';
    slot.appendChild(UI.createCardElement(selectedDeployCard.value, 'player'));
    slot.setAttribute('data-value', selectedDeployCard.value);
    selectedDeployCard.el.remove();
    selectedDeployCard = null;
    updateRealTimeDashboard();
    checkDeployFull();
};

async function checkDeployFull() {
    const slots = getPlayerSlots();
    if (slots[0] && slots[1] && slots[2]) {
        updateRealTimeDashboard("CALCULATING..."); 
        await UI.sleep(500);
        resolveBattle(slots);
    }
}

async function resolveBattle(pArrangement) {
    UI.setAIStatus('决斗开始！');
    
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
    let baseDamage = Math.abs(pTotal - aTotal) * multiplier * State.heat;
    
    for (let i = 0; i < 3; i++) {
        const lane = document.getElementById(`lane-${i}`);
        const indicator = lane.querySelector('.rule-indicator');
        indicator.innerText = modes[i] === 'HIGH' ? '>' : '<';
        indicator.style.color = 'white';
        await UI.sleep(1000);
        const winner = Core.compareLane(pArrangement[i], aiArrangement[i], modes[i]);
        if (winner === 'PLAYER') {
            pWins++;
            lane.style.borderColor = '#00f3ff';
            lane.style.boxShadow = '0 0 20px #00f3ff';
        } else if (winner === 'AI') {
            aWins++;
            lane.style.borderColor = '#ff2a6d';
            lane.style.boxShadow = '0 0 20px #ff2a6d';
        } else {
            lane.style.borderColor = '#ffd700';
        }
    }

    // 完胜翻倍
    if ((pWins === 3) || (aWins === 3)) {
        baseDamage *= 2;
        await UI.notify('⚡ 三相碾压！伤害翻倍！⚡', 2000, '#ffd700');
    }

    let isDraw = false;
    let winner = null;
    if (pWins >= 2) winner = 'PLAYER';
    else if (aWins >= 2) winner = 'AI';
    else isDraw = true;

    if (isDraw) {
        State.jackpot += baseDamage;
        updateRealTimeDashboard(baseDamage);
        await UI.notify('平局！伤害存入奖池', 2000, 'white');
    } 
    else {
        const finalDamage = baseDamage + State.jackpot;
        updateRealTimeDashboard(finalDamage);

        if (winner === 'PLAYER') {
            await UI.notify(`胜利！造成 ${finalDamage}`, 2000, '#00f3ff');
            
            let damageToAI = finalDamage;
            
            // 【修正】AI 极限加注失败惩罚
            if (State.aiDoubling && State.aiDebt > 100) {
                 const debtPenalty = State.aiDebt;
                 const roundPenalty = Math.floor(finalDamage * 1.5);
                 const totalPenalty = debtPenalty + roundPenalty;
                 
                 await UI.notify(`AI 极限失败：清算总额 ${totalPenalty} HP！`, 1500, 'red');
                 State.aiHP -= totalPenalty; 
                 State.aiDebt = 0; 
            } 
            else if (State.aiDoubling) {
                 State.aiHP -= Math.floor(damageToAI * 1.5);
            }
            else {
                State.aiDebt += damageToAI;
            }

            if (State.pDebt > 0) State.pDebt = 0;
        } 
        else { // AI WIN - 玩家失败
            await UI.notify(`失败... 承受 ${finalDamage}`, 2000, '#ff2a6d');
            
            let damageToPlayer = finalDamage;

            // 【修正】玩家极限加注失败惩罚
            if (State.pDoubling && State.pDebt > 100) {
                const debtPenalty = State.pDebt;
                const roundPenalty = Math.floor(finalDamage * 1.5);
                const totalPenalty = debtPenalty + roundPenalty;
                
                await UI.notify(`极限失败：清算总额 ${totalPenalty} HP！`, 1500, 'red');
                State.playerHP -= totalPenalty; 
                State.pDebt = 0; 
            } 
            else {
                State.pDebt += damageToPlayer;
                if (State.pDoubling) State.pDebt = Math.floor(damageToPlayer * 1.5);
            }
            
            if (State.aiDebt > 0) State.aiDebt = 0;
        }
        State.jackpot = 0;
    }
    
    updateGameState();
    
    // 检查死亡 (仅检查 HP)
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