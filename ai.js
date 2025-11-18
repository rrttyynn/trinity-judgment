import * as Core from './core.js';

export function getDebtAction(aiHP, aiDebt, heat) {
    if (aiDebt < 80) return 'PAY'; 
    if (aiDebt > 120 || heat >= 3 || aiHP < 80) return 'DOUBLE';
    return 'PAY';
}

export function getBestDraft(pool, aiHand, pHand, jackpot, heat) {
    const result = minimax(pool, aiHand, pHand, true, -Infinity, Infinity, jackpot, heat);
    return result.card || pool[0];
}

function minimax(pool, aiHand, pHand, isAiTurn, alpha, beta, jackpot, heat) {
    if (pool.length === 1) {
        return { score: evaluateFinalState(pool[0], aiHand, pHand), card: null };
    }
    let bestMove = null;
    if (isAiTurn) {
        let maxEval = -Infinity;
        for (let card of pool) {
            const evalObj = minimax(pool.filter(c => c !== card), [...aiHand, card], pHand, false, alpha, beta, jackpot, heat);
            if (evalObj.score > maxEval) { maxEval = evalObj.score; bestMove = card; }
            alpha = Math.max(alpha, evalObj.score);
            if (beta <= alpha) break; 
        }
        return { score: maxEval, card: bestMove };
    } else {
        let minEval = Infinity;
        for (let card of pool) {
            const evalObj = minimax(pool.filter(c => c !== card), aiHand, [...pHand, card], true, alpha, beta, jackpot, heat);
            if (evalObj.score < minEval) { minEval = evalObj.score; bestMove = card; }
            beta = Math.min(beta, evalObj.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, card: bestMove };
    }
}

// 终局估值函数 (Minimax 评估)
function evaluateFinalState(judgeCard, aiHand, pHand) {
    const rule = Core.getJudgeRule(judgeCard);
    
    // AI 部署：使用最强的攻击性策略
    const pArr_Likely = optimizeHand(pHand, rule); 
    const aiArr = getDeploymentExploit(aiHand, pArr_Likely, rule)[0]; 
    
    // 基础伤害计算
    const pTotal = Core.calculateMixedSum([], pArr_Likely, rule);
    const aTotal = Core.calculateMixedSum([], aiArr, rule);
    let rawDamage = Math.abs(pTotal - aTotal); 
    
    // 判定胜负 (路数)
    let pWins = 0; let aWins = 0;
    const modes = Core.getLaneModes(rule);
    for (let i = 0; i < 3; i++) {
        const winner = Core.compareLane(pArr_Likely[i], aiArr[i], modes[i]);
        if (winner === 'PLAYER') pWins++; else if (winner === 'AI') aWins++;
    }
    
    let winner = null;
    if (pWins >= 2) winner = 'PLAYER'; else if (aWins >= 2) winner = 'AI';

    // 终局倍率和伤害
    if ((winner === 'PLAYER' && pWins === 3) || (winner === 'AI' && aWins === 3)) rawDamage *= 2;
    
    // Minimax 目标：最大化 AI 的净伤害
    if (winner === 'AI') return rawDamage; 
    else if (winner === 'PLAYER') return -rawDamage; 
    return 0;
}


// 基础最优布阵 (用于预测玩家 / 消除智障行为)
export function optimizeHand(hand, rule) {
    if (hand.length < 3) return hand;

    const perms = getAllPermutations(hand);
    const modes = Core.getLaneModes(rule);
    let bestPerm = perms[0];
    let bestScore = -Infinity;

    for (let perm of perms) {
        let currentScore = 0;
        for (let i = 0; i < 3; i++) {
            const cardValue = perm[i];
            const mode = modes[i];
            
            // 评分逻辑：明确根据模式目标赋值，确保大牌进 HIGH，小牌进 LOW
            if (mode === 'HIGH') {
                // HIGH 模式：Ace=14, K=13. 分数等于有效点数。
                currentScore += Core.getCardPoint(cardValue, 'HIGH'); 
            } else { 
                // LOW 模式：Ace=1, 2=2. 分数通过 (15 - 有效点数) 转换，确保小点数获得高分。
                currentScore += (15 - Core.getCardPoint(cardValue, 'LOW')); 
            }
        }
        if (currentScore > bestScore) { 
            bestScore = currentScore; 
            bestPerm = perm; 
        }
    }
    return bestPerm;
}

// 攻击性部署 (返回最优和次优)
export function getDeploymentExploit(aiHand, pArr_Likely, rule) {
    const aiPerms = getAllPermutations(aiHand);
    const modes = Core.getLaneModes(rule);

    let maxNetDamage = -Infinity;
    let bestArrangement = aiHand;
    let secondBestArrangement = aiHand; 

    for (let aArr of aiPerms) {
        let pWins = 0;
        let aWins = 0;
        for (let i = 0; i < 3; i++) {
            const winner = Core.compareLane(pArr_Likely[i], aArr[i], modes[i]);
            if (winner === 'PLAYER') pWins++;
            else if (winner === 'AI') aWins++;
        }
        
        let pTotal = Core.calculateMixedSum([], pArr_Likely, rule);
        let aTotal = Core.calculateMixedSum([], aArr, rule);
        let damageDifference = Math.abs(pTotal - aTotal); 
        
        let currentNetDamage = 0;
        
        if (aWins >= 2) {
            if (aWins === 3) damageDifference *= 2;
            currentNetDamage = damageDifference;
        } else if (pWins >= 2) {
             if (pWins === 3) damageDifference *= 2;
             currentNetDamage = -damageDifference;
        }

        if (currentNetDamage > maxNetDamage) {
            secondBestArrangement = bestArrangement; 
            maxNetDamage = currentNetDamage;
            bestArrangement = aArr;
        }
    }
    
    if (JSON.stringify(bestArrangement) === JSON.stringify(secondBestArrangement)) {
        const diffArr = aiPerms.find(arr => JSON.stringify(arr) !== JSON.stringify(bestArrangement));
        if (diffArr) secondBestArrangement = diffArr;
    }
    
    return [bestArrangement, secondBestArrangement]; 
}

function getAllPermutations(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) => getAllPermutations(arr.filter((_, j) => j !== i)).map(p => [v, ...p]));
}