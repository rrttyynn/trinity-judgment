// ai.js v7.2 (Hardcore Aggressive AI)

import * as Core from './core.js';

export function getDebtAction(aiHP, aiDebt, heat) {
    if (aiDebt < 50 && aiHP > 100) return 'PAY';
    if (aiDebt > 120 || heat >= 3 || aiHP < 80) return 'DOUBLE';
    return 'PAY';
}

// 2. 抢牌入口 (Minimax)
export function getBestDraft(pool, aiHand, pHand, jackpot, heat) {
    const result = minimax(pool, aiHand, pHand, true, -Infinity, Infinity, jackpot, heat);
    return result.card || pool[0];
}

// 3. 核心算法：Minimax 递归搜索
function minimax(pool, aiHand, pHand, isAiTurn, alpha, beta, jackpot, heat) {
    if (pool.length === 1) {
        // 终局估值：基于 Maximize Damage Against Greedy Player
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

// 4. 【核心】终局估值函数：AI 假设玩家会贪婪地布阵
function evaluateFinalState(judgeCard, aiHand, pHand) {
    const rule = Core.getJudgeRule(judgeCard);
    
    // 1. 假设玩家布阵：玩家使用最简单的贪婪启发式 (Greedy Heuristic)
    const pArr_Likely = optimizeHand(pHand, rule); 
    
    // 2. AI 布阵：AI 找到一个能对 pArr_Likely 造成最大伤害的排列
    // 注意：这里调用的是实际的攻击性部署策略
    const aiArr = getDeploymentExploit(aiHand, pArr_Likely, rule); 

    // 3. 结算伤害
    const pTotal = Core.calculateMixedSum([], pArr_Likely, rule);
    const aTotal = Core.calculateMixedSum([], aiArr, rule);
    const damageDifference = Math.abs(pTotal - aTotal); 
    
    // 4. 判定胜负 (路数)
    let pWins = 0;
    let aWins = 0;
    const modes = Core.getLaneModes(rule);

    for (let i = 0; i < 3; i++) {
        const winner = Core.compareLane(pArr_Likely[i], aiArr[i], modes[i]);
        if (winner === 'PLAYER') pWins++;
        else if (winner === 'AI') aWins++;
    }
    
    let isDraw = false;
    let winner = null;
    if (pWins >= 2) winner = 'PLAYER';
    else if (aWins >= 2) winner = 'AI';
    else isDraw = true;

    // 5. Minimax 评分：AI 追求最大伤害
    if (isDraw) return 0;
    
    let rawDamage = damageDifference; 
    if ((winner === 'PLAYER' && pWins === 3) || (winner === 'AI' && aWins === 3)) {
         rawDamage *= 2;
    }

    // AI 赢，得分是正的伤害值 (Maximize)
    if (winner === 'AI') return rawDamage; 
    // 玩家赢，得分是负的伤害值 (Minimize)
    return -rawDamage;
}


// 5. 【核心】布阵策略 1: 贪婪启发式 (用于预测玩家)
export function optimizeHand(hand, rule) {
    if (hand.length < 3) return hand;

    const perms = getAllPermutations(hand);
    const modes = Core.getLaneModes(rule);
    let bestPerm = perms[0];
    let bestScore = -Infinity;

    for (let perm of perms) {
        let currentScore = 0;
        for (let i = 0; i < 3; i++) {
            const val = Core.getCardPoint(perm[i], modes[i]);
            // 简单启发式：HIGH模式喜欢大牌，LOW模式喜欢小牌
            if (modes[i] === 'HIGH') {
                currentScore += val; 
            } else {
                currentScore += (15 - val); // 牌值越小，分数越高
            }
        }
        if (currentScore > bestScore) {
            bestScore = currentScore;
            bestPerm = perm;
        }
    }
    return bestPerm;
}

// 6. 【核心】布阵策略 2: 攻击性部署 (用于 AI 实际布阵)
export function getDeploymentExploit(aiHand, pArr_Likely, rule) {
    const aiPerms = getAllPermutations(aiHand);
    const modes = Core.getLaneModes(rule);

    let bestArrangement = aiHand;
    let maxNetDamage = -Infinity;

    // AI 遍历自己的所有排列
    for (let aArr of aiPerms) {
        
        let pWins = 0;
        let aWins = 0;
        
        // 1. 判定胜负 (路数)
        for (let i = 0; i < 3; i++) {
            const winner = Core.compareLane(pArr_Likely[i], aArr[i], modes[i]);
            if (winner === 'PLAYER') pWins++;
            else if (winner === 'AI') aWins++;
        }
        
        let currentNetDamage = 0;
        const pTotal = Core.calculateMixedSum([], pArr_Likely, rule);
        const aTotal = Core.calculateMixedSum([], aArr, rule);
        let damageDifference = Math.abs(pTotal - aTotal); 
        
        // 2. 只有赢了才算正分，输了算负分
        if (aWins >= 2) {
            if (aWins === 3) damageDifference *= 2;
            currentNetDamage = damageDifference;
        } else if (pWins >= 2) {
             if (pWins === 3) damageDifference *= 2;
             currentNetDamage = -damageDifference;
        } else {
            currentNetDamage = 0;
        }
        
        // 3. 追求最大伤害
        if (currentNetDamage > maxNetDamage) {
            maxNetDamage = currentNetDamage;
            bestArrangement = aArr;
        } else if (currentNetDamage === maxNetDamage && currentNetDamage > 0) {
            // 伤害相同，倾向于选择有更多路数的 (次要目标)
            let currentBestWins = 0;
            const currentBestArr = bestArrangement;
            for (let i = 0; i < 3; i++) {
                if (Core.compareLane(pArr_Likely[i], currentBestArr[i], modes[i]) === 'AI') currentBestWins++;
            }

            if (aWins > currentBestWins) {
                 bestArrangement = aArr;
            }
        }
    }
    
    return bestArrangement;
}

function getAllPermutations(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) => getAllPermutations(arr.filter((_, j) => j !== i)).map(p => [v, ...p]));
}