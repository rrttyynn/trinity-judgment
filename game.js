import * as Core from './core.js';
import * as UI from './ui.js';

// === State Refactoring: AI -> P2 ===
const State = {
    p1HP: 200,
    p2HP: 200, // P2 (formerly AI) HP
    p1Debt: 0,
    p2Debt: 0, // P2 Debt
    round: 1,
    deck: [],
    pool: [],
    p1Hand: [], 
    p2Hand: [], // P2 Hand
    p1Arrangement: [],
    p2Arrangement: [], // P2 Deployment
    judgeCard: null,
    rule: null,
    p1Doubling: false,
    p2Doubling: false, // P2 Doubling
    phase: 'IDLE',
    firstMover: 'PLAYER1', // PLAYER1 or PLAYER2
    activePlayer: 'PLAYER1', // Current player interacting
    heat: 1,
    jackpot: 0,
    // P2 specific fields
    p2DebtAction: null 
};

window.startGame = async () => {
    document.getElementById('btn-start').classList.add('hidden');
    updateGameState();
    startRound();
};

function updateGameState() {
    // UI update adjusted for P1/P2
    UI.updateStats(State.p1HP, State.p2HP, State.p1Debt, State.p2Debt);
    UI.updateEnvironment(State.heat, State.jackpot);
}

// Function to simplify deployment update
function updatePvpArrangements(p1Arr, p2Arr) {
    State.p1Arrangement = p1Arr;
    State.p2Arrangement = p2Arr;
}

// --- Debt Phase Management ---
async function handleDebtPhase(player) {
    State.activePlayer = player;
    const isP1 = player === 'PLAYER1';
    
    // Hotseat switch for debt resolution
    await UI.showHotseatModal(isP1 ? 1 : 2);
    
    const debt = isP1 ? State.p1Debt : State.p2Debt;
    
    if (debt > 0) {
        State.phase = 'DEBT';
        let debtWarning = `死缓池: ${debt}`;
        if (debt > 100) {
            debtWarning += " ⚠ 高风险！加注失败将直接扣除生命！";
        }
        await UI.notify(debtWarning, 1500, debt > 100 ? 'red' : 'red');
        
        // Show debt options and wait for user click
        UI.showDebtOptions(true, isP1 ? 1 : 2);
        return new Promise(resolve => {
            window.debtResolved = (action) => {
                if (action === 'PAY') {
                    const cost = Math.floor(debt * 0.3);
                    if (isP1) State.p1HP -= cost; else State.p2HP -= cost;
                    if (isP1) State.p1Debt = 0; else State.p2Debt = 0;
                    UI.notify(`已认罪。扣除 ${cost} (30% cost)`, 1000, 'orange');
                } else {
                    if (isP1) State.p1Doubling = true; else State.p2Doubling = true;
                    if (debt > 100) {
                        UI.notify('极限加注：输了直接扣血！', 1500, 'red');
                    } else {
                        UI.notify('加注确认！风险 x1.5', 1000, 'red');
                    }
                }
                UI.showDebtOptions(false);
                updateGameState();
                resolve();
            };
        });
    }
}
window.debtResolved = () => {}; // Global hook for button clicks

window.payDebt = () => { window.debtResolved('PAY'); };
window.doubleDown = () => { window.debtResolved('DOUBLE'); };


async function startRound() {
    UI.clearBattlefield();
    State.p1Hand = [];
    State.p2Hand = [];
    State.p1Doubling = false;
    State.p2Doubling = false;
    State.firstMover = State.round % 2 !== 0 ? 'PLAYER1' : 'PLAYER2';
    State.heat = Math.floor((State.round - 1) / 3) + 1;
    updateGameState();
    UI.updateDashboard(0, 0, '?', 0);

    // 1. P1 Debt Phase
    await handleDebtPhase('PLAYER1');
    if (State.p1HP <= 0) { UI.notify('P1 Game Over', 99999, 'red'); return; }

    // 2. P2 Debt Phase
    await handleDebtPhase('PLAYER2');
    if (State.p2HP <= 0) { UI.notify('P2 Game Over', 99999, 'red'); return; }

    // 3. Start Drafting
    proceedToDraft();
}


// --- Drafting Phase ---
async function proceedToDraft() {
    State.phase = 'DRAFT';
    State.deck = Core.createDeck();
    State.pool = State.deck.slice(0, 7);
    
    // Determine who starts
    State.activePlayer = State.firstMover;
    
    await UI.notify(`Round ${State.round} [Heat x${State.heat}] - ${State.firstMover} 先手`, 1500, '#ffd700');
    
    // Start the draft loop
    draftLoop();
}

async function draftLoop() {
    UI.setPlayerStatus(State.activePlayer === 'PLAYER1' ? 1 : 2, 'Selecting...');
    
    // Hotseat switch for drafting
    await UI.showHotseatModal(State.activePlayer === 'PLAYER1' ? 1 : 2);

    UI.renderDraftPool(State.pool, handleDraftPick);
}

window.handleDraftPick = (value) => {
    if (State.phase !== 'DRAFT') return;

    const isP1 = State.activePlayer === 'PLAYER1';
    const activeHand = isP1 ? State.p1Hand : State.p2Hand;

    // Pick the card
    const pIdx = State.pool.indexOf(value);
    if (pIdx > -1) {
        activeHand.push(value);
        State.pool.splice(pIdx, 1);
    }
    
    // Rerender hands and pool
    UI.renderHand('p1-hand-zone', State.p1Hand, false);
    UI.renderHand('p2-hand-zone', State.p2Hand, false);
    UI.renderDraftPool(State.pool, null); 
    
    // Check for end of draft
    if (State.pool.length === 1) {
        endDraftPhase();
        return;
    }
    
    // Switch turn
    State.activePlayer = isP1 ? 'PLAYER2' : 'PLAYER1';
    draftLoop();
};


async function endDraftPhase() {
    State.judgeCard = State.pool[0];
    State.rule = Core.getJudgeRule(State.judgeCard);
    
    UI.renderDraftPool([], null); 
    await UI.revealJudge(State.judgeCard, State.rule);
    
    // 部署阶段：P1 先部署
    State.activePlayer = 'PLAYER1';
    proceedToDeployment();
}


// --- Deployment Phase ---
async function proceedToDeployment() {
    State.phase = 'DEPLOY';
    const isP1 = State.activePlayer === 'PLAYER1';
    
    await UI.showHotseatModal(isP1 ? 1 : 2);

    UI.setPlayerStatus(isP1 ? 1 : 2, 'Deploying...');
    UI.setPlayerStatus(isP1 ? 2 : 1, 'Waiting...');
    
    const activeHand = isP1 ? State.p1Hand : State.p2Hand;
    const handZoneId = isP1 ? 'p1-hand-zone' : 'p2-hand-zone';
    
    // Render active player's hand for deployment
    document.getElementById(handZoneId).innerHTML = '';
    activeHand.forEach(value => {
        const card = UI.createCardElement(value, isP1 ? 'p1' : 'p2');
        card.onclick = () => selectCardToDeploy(card, value);
        document.getElementById(handZoneId).appendChild(card);
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
    const isP1 = State.activePlayer === 'PLAYER1';
    const slotSelector = isP1 ? '.p1-slot' : '.p2-slot';
    const lane = document.getElementById(`lane-${laneIndex}`);
    const slot = lane.querySelector(slotSelector);
    
    if (slot.hasAttribute('data-value')) return; 
    
    slot.innerHTML = '';
    slot.appendChild(UI.createCardElement(selectedDeployCard.value, isP1 ? 'p1' : 'p2'));
    slot.setAttribute('data-value', selectedDeployCard.value);
    selectedDeployCard.el.remove();
    selectedDeployCard = null;
    
    // Update the hand array (remove the card)
    const activeHand = isP1 ? State.p1Hand : State.p2Hand;
    const cardIndex = activeHand.indexOf(selectedDeployCard.value);
    if (cardIndex > -1) activeHand.splice(cardIndex, 1);
    
    checkDeployCompletion();
};

async function checkDeployCompletion() {
    const isP1 = State.activePlayer === 'PLAYER1';
    const activeHand = isP1 ? State.p1Hand : State.p2Hand;

    // Check if the current player's hand is empty (3 cards placed)
    if (activeHand.length === 0) {
        
        // If P1 just finished, switch to P2 deployment
        if (isP1) {
            State.activePlayer = 'PLAYER2';
            proceedToDeployment();
        } 
        // If P2 just finished, start the battle
        else {
            State.phase = 'BATTLE';
            UI.setPlayerStatus(1, 'Awaiting Battle');
            UI.setPlayerStatus(2, 'Awaiting Battle');
            await UI.sleep(500);
            resolveBattle();
        }
    }
}


// --- Battle Resolution Phase ---
async function resolveBattle() {
    // 收集最终部署的卡牌数组
    const p1Arrangement = getDeployedCards('p1');
    const p2Arrangement = getDeployedCards('p2');

    // 检查数组完整性
    if (p1Arrangement.length !== 3 || p2Arrangement.length !== 3) {
         return UI.notify('Error: Incomplete deployment!', 99999, 'red');
    }

    UI.setPlayerStatus(1, 'Dueling...');
    UI.setPlayerStatus(2, 'Dueling...');

    let p1Wins = 0;
    let p2Wins = 0;
    const modes = Core.getLaneModes(State.rule);
    const multiplier = Core.getJudgeMultiplier(State.judgeCard);

    // 1. 获取总点数，用于伤害计算
    const p1Total = Core.calculateMixedSum([], p1Arrangement, State.rule);
    const p2Total = Core.calculateMixedSum([], p2Arrangement, State.rule);
    const damageDifference = Math.abs(p1Total - p2Total); 
    
    // 2. 逐路判定 (演出)
    for (let i = 0; i < 3; i++) {
        const lane = document.getElementById(`lane-${i}`);
        const indicator = lane.querySelector('.rule-icon');
        
        const p1Card = p1Arrangement[i];
        const p2Card = p2Arrangement[i];
        const mode = modes[i];
        
        const p1ValEff = Core.getCardPoint(p1Card, mode);
        const p2ValEff = Core.getCardPoint(p2Card, mode);
        
        const winner = Core.compareLane(p1Card, p2Card, mode);
        
        indicator.innerText = modes[i] === 'HIGH' ? 'HIGH' : 'LOW';
        indicator.style.color = 'white';
        await UI.sleep(1500); 

        if (winner === 'PLAYER') {
            p1Wins++;
            lane.style.borderColor = '#00f3ff';
            indicator.innerText = 'P1 WIN'; 
            await UI.notify(`P1 Wins Lane ${i+1}! (${p1ValEff} vs ${p2ValEff})`, 1000, '#00f3ff');
        } else if (winner === 'AI') { // AI winner becomes P2 winner
            p2Wins++;
            lane.style.borderColor = '#ff2a6d';
            indicator.innerText = 'P2 WIN';
            await UI.notify(`P2 Wins Lane ${i+1}! (${p1ValEff} vs ${p2ValEff})`, 1000, '#ff2a6d');
        } else {
            lane.style.borderColor = '#ffd700';
            indicator.innerText = `DRAW`; 
            await UI.notify(`Lane ${i+1}: Draw (${p1ValEff} vs ${p2ValEff})`, 1000, '#ffd700');
        }
        
        // Update Dashboard with current battle stats
        UI.updateDashboard(p1Total, p2Total, multiplier + "x" + State.heat, damageDifference + multiplier * State.heat + State.jackpot);
        await UI.sleep(500); 
    }

    // --- Final Tally and Consequence ---
    let baseDamageWithHeat = damageDifference + (multiplier * State.heat); 
    let isDraw = false;
    let winner = null; // 'P1', 'P2' or null
    
    if (p1Wins >= 2) winner = 'P1';
    else if (p2Wins >= 2) winner = 'P2';
    else isDraw = true;

    // Optional: Trinity Crush Bonus
    if ((winner === 'P1' && p1Wins === 3) || (winner === 'P2' && p2Wins === 3)) {
         baseDamageWithHeat *= 2;
         await UI.notify('⚡ Trinity Crush! Damage x2! ⚡', 2000, '#ffd700');
    }
    
    if (isDraw) {
        State.jackpot += 10; 
        await UI.notify('Draw! Jackpot +10!', 2000, 'white');
    } 
    else {
        const finalDamage = baseDamageWithHeat + State.jackpot;
        const loserIsP1 = winner === 'P2';
        
        if (winner === 'P1') {
            await applyDamageAndDebt(finalDamage, State.p2Debt, State.p2Doubling, 'PLAYER2', 'PLAYER1');
            if (State.p1Debt > 0) State.p1Debt = 0; // Winner clears own debt
        } 
        else { // Winner is P2
            await applyDamageAndDebt(finalDamage, State.p1Debt, State.p1Doubling, 'PLAYER1', 'PLAYER2');
            if (State.p2Debt > 0) State.p2Debt = 0; // Winner clears own debt
        }
        State.jackpot = 0;
    }
    
    updateGameState();
    
    // --- Final Death Check ---
    if (State.p1HP <= 0) { UI.notify('P1 GAME OVER', 99999, 'red'); return; }
    if (State.p2HP <= 0) { UI.notify('P2 GAME OVER', 99999, 'red'); return; }
    
    State.round++;
    await UI.sleep(3000);
    
    // Clear lane highlights and reset for next round
    document.querySelectorAll('.lane-column').forEach(l => {
        l.style.borderColor = 'rgba(255,255,255,0.1)';
        l.style.boxShadow = 'none';
        l.querySelector('.rule-icon').innerText = '?';
    });
    
    startRound();
}

// Helper to collect deployed cards
function getDeployedCards(player) {
    const arr = [];
    const slotSelector = player === 'p1' ? '.p1-slot' : '.p2-slot';
    for(let i=0; i<3; i++) {
        const slot = document.getElementById(`lane-${i}`).querySelector(slotSelector);
        if (slot.hasAttribute('data-value')) {
            arr.push(parseInt(slot.getAttribute('data-value')));
        }
    }
    return arr;
}

// Helper to apply damage and debt penalties (Centralizing the Extreme Doubling logic)
async function applyDamageAndDebt(damage, loserDebt, loserDoubling, loserName, winnerName) {
    let damageToApply = damage;
    const isExtreme = loserDebt > 100 && loserDoubling;
    const isP1Loser = loserName === 'PLAYER1';

    if (isExtreme) {
        const debtPenalty = loserDebt;
        const roundPenalty = Math.floor(damage * 1.5);
        const totalPenalty = debtPenalty + roundPenalty;
        
        await UI.notify(`${loserName} 极限失败：清算总额 ${totalPenalty} HP！`, 1500, 'red');
        
        if (isP1Loser) State.p1HP -= totalPenalty;
        else State.p2HP -= totalPenalty;
        
        // Debt is cleared due to payment
        if (isP1Loser) State.p1Debt = 0;
        else State.p2Debt = 0;
        
    } else if (loserDoubling) {
        // Normal Doubling loss (1.5x to debt pool)
        const penalty = Math.floor(damageToApply * 1.5);
        if (isP1Loser) State.p1Debt += penalty;
        else State.p2Debt += penalty;
    } else {
        // Normal Loss (added to debt pool)
        if (isP1Loser) State.p1Debt += damageToApply;
        else State.p2Debt += damageToApply;
    }

    // Reset doubling state
    if (isP1Loser) State.p1Doubling = false;
    else State.p2Doubling = false;

    // Reset doubling state on winner (just in case they were doubling last round)
    if (winnerName === 'PLAYER1') State.p1Doubling = false;
    else State.p2Doubling = false;

    await UI.notify(`${loserName} Loses!`, 1000, '#ff2a6d');
}