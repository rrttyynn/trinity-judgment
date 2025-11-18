import * as Core from './core.js';

export function getDebtAction(aiHP, aiDebt, heat) {
    if (aiDebt < 80) return 'PAY'; 
    if (aiDebt > 120 || heat >= 3 || aiHP < 80) return 'DOUBLE';
    return 'PAY';
}

// 抢牌入口 (Minimax)
export function getBestDraft(pool, aiHand, pHand, jackpot, heat) {
    const result = minimax(pool, aiHand, pHand, true, -Infinity, Infinity, jackpot, heat);
    return result.card || pool[0];
}

// 核心 Minimax
function minimax(pool, aiHand, pHand, isAiTurn, alpha, beta, jackpot, heat) {
    if (pool.length === 1) {
        // 终局状态估值 (Minimax叶节点)
        let score = evaluateFinalState(pool[0], aiHand, pHand);

        // 如果留下的 Judge Card 具有高倍率，为 AI 增加分数，鼓励规则控制
        const multiplier = Core.getJudgeMultiplier(pool[0]);
        if (multiplier >= 12) { score += multiplier * 2; } 
        else if (multiplier <= 3) { score -= 5; }

        return { score: score, card: null };
    }
    
    // 【核心修复】：动态计算牌池中的最大值和最小值
    const poolMin = Math.min(...pool);
    const poolMax = Math.max(...pool);

    if (isAiTurn) {
        let maxEval = -Infinity;
        let bestMove = null;
        for (let card of pool) {
            let cardBonus = 0;
            // 【绝对牌权奖励】：争夺当前牌池中的最高/最低牌
            if (card === poolMax || card === poolMin) {
                cardBonus = 20; // 巨额奖励，使其成为主要目标
            }
            
            const evalObj = minimax(pool.filter(c => c !== card), [...aiHand, card], pHand, false, alpha, beta, jackpot, heat);
            
            const finalScore = evalObj.score + cardBonus; 

            if (finalScore > maxEval) { maxEval = finalScore; bestMove = card; }
            alpha = Math.max(alpha, finalScore);
            if (beta <= alpha) break; 
        }
        return { score: maxEval, card: bestMove };
    } else {
        let minEval = Infinity;
        let bestMove = null;
        for (let card of pool) {
            let cardPenalty = 0;
            // 【绝对牌权惩罚】：让玩家抢走最高/最低牌
            if (card === poolMax || card === poolMin) {
                cardPenalty = -20; // 巨额惩罚
            }

            const evalObj = minimax(pool.filter(c => c !== card), aiHand, [...pHand, card], true, alpha, beta, jackpot, heat);
            
            const finalScore = evalObj.score + cardPenalty;

            if (finalScore < minEval) { minEval = finalScore; bestMove = card; }
            beta = Math.min(beta, finalScore);
            if (beta <= alpha) break;
        }
        return { score: minEval, card: bestMove };
    }
}

// 终局估值函数 (伤害公式计算)
function evaluateFinalState(judgeCard, aiHand, pHand) {
    const rule = Core.getJudgeRule(judgeCard);
    
    // 假设玩家布阵：贪婪启发式 (AI部署的基础预测)
    const pArr_Likely = optimizeHand(pHand, rule); 
    
    // AI 布阵：全知攻击性策略
    const [aiArr, ] = getDeploymentExploit(aiHand, pArr_Likely, rule); 
    
    // 1. 基础伤害计算 (SUM Difference)
    const baseDamageDiff = Core.calculateDamageDifference(pArr_Likely, aiArr, rule);
    const multiplier = Core.getJudgeMultiplier(judgeCard);
    
    let rawDamage = baseDamageDiff + multiplier; 

    // 2. 判定胜负 (路数)
    let pWins = 0; let aWins = 0;
    const modes = Core.getLaneModes(rule);
    for (let i = 0; i < 3; i++) {
        const winner = Core.compareLane(pArr_Likely[i], aiArr[i], modes[i]);
        if (winner === 'PLAYER') pWins++; else if (winner === 'AI') aWins++;
    }
    
    let isDraw = false; let winner = null;
    if (pWins >= 2) winner = 'PLAYER'; else if (aWins >= 2) winner = 'AI'; else isDraw = true;

    // 完胜暴击
    if ((winner === 'PLAYER' && pWins === 3) || (winner === 'AI' && aWins === 3)) rawDamage *= 2;

    // Minimax 目标：最大化 AI 的净伤害
    if (winner === 'AI') return rawDamage; 
    else if (winner === 'PLAYER') return -rawDamage; 
    return 0;
}


// 基础最优布阵 (HIGH/LOW 绝对值优化)
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
            
            // 评分逻辑：确保大小牌放对位置
            if (modes[i] === 'HIGH') {
                currentScore += Core.getCardPoint(cardValue, 'HIGH'); 
            } else { 
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

// 攻击性部署 (AI实际执行的部署策略)
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