import * as Core from './core.js';

// 1. 死缓决策：保持不变 (平衡性考虑)
export function getDebtAction(aiHP, aiDebt, heat) {
    if (aiDebt > 90) return 'DOUBLE'; 
    if (heat >= 3 || aiHP < 80) return 'DOUBLE';
    if (aiHP > 120 && aiDebt < 40) return 'DOUBLE';
    return 'PAY';
}

// 2. 抢牌入口 (全深度 Minimax)
export function getBestDraft(pool, aiHand, pHand) {
    // 开启全深度搜索，计算最佳牌和得分
    const result = minimax(pool, aiHand, pHand, true, -Infinity, Infinity);
    
    // 返回 AI 决策出的最优牌
    return result.card || pool[0];
}

// 3. 核心算法：Minimax 递归搜索
function minimax(pool, aiHand, pHand, isAiTurn, alpha, beta) {
    // 【终止条件】：池子里只剩 1 张牌 (审判牌确定)
    if (pool.length === 1) {
        const judgeCard = pool[0];
        // 返回最终战斗结果的净得分
        const finalScore = evaluateFinalState(judgeCard, aiHand, pHand);
        return { score: finalScore, card: null };
    }

    let bestMove = null;

    if (isAiTurn) {
        // AI 回合：寻找【最大】收益
        let maxEval = -Infinity;
        
        for (let card of pool) {
            // 模拟 AI 拿走这张牌
            const remainingPool = pool.filter(c => c !== card);
            const nextHand = [...aiHand, card];
            
            // 递归进入下一层（轮到玩家）
            const evalObj = minimax(remainingPool, nextHand, pHand, false, alpha, beta);
            
            if (evalObj.score > maxEval) {
                maxEval = evalObj.score;
                bestMove = card;
            }
            
            // Alpha-Beta 剪枝
            alpha = Math.max(alpha, evalObj.score);
            if (beta <= alpha) break; 
        }
        return { score: maxEval, card: bestMove };
        
    } else {
        // 玩家回合：假设玩家也是绝顶高手，会寻找让 AI 收益【最小】的走法
        let minEval = Infinity;
        
        for (let card of pool) {
            // 模拟玩家拿走这张牌
            const remainingPool = pool.filter(c => c !== card);
            const nextHand = [...pHand, card];
            
            // 递归进入下一层（轮到 AI）
            const evalObj = minimax(remainingPool, aiHand, nextHand, true, alpha, beta);
            
            if (evalObj.score < minEval) {
                minEval = evalObj.score;
                bestMove = card; // 理论上不需要记录玩家的最佳牌，但这里为了结构完整性保留
            }
            
            beta = Math.min(beta, evalObj.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, card: bestMove };
    }
}

// 4. 终局估值函数 (用于 Minimax 基础分)
function evaluateFinalState(judgeCard, aiHand, pHand) {
    const rule = Core.getJudgeRule(judgeCard);
    const multiplier = Core.getJudgeMultiplier(judgeCard);
    
    // AI 和 玩家都使用最优布阵
    const aiArr = optimizeHand(aiHand, rule);
    const pArr = optimizeHand(pHand, rule); 
    
    // 模拟战斗
    const modes = Core.getLaneModes(rule);
    let aiWins = 0;
    let pWins = 0;
    
    // 计算总点数差（用于伤害计算）
    const aiTotal = Core.calculateMixedSum([], aiArr, rule);
    const pTotal = Core.calculateMixedSum([], pArr, rule);
    let rawDamage = Math.abs(aiTotal - pTotal) * multiplier; // 注意：这里不乘 heat，heat由 game.js 统一处理

    for (let i = 0; i < 3; i++) {
        const res = Core.compareLane(pArr[i], aiArr[i], modes[i]);
        if (res === 'AI') aiWins++;
        if (res === 'PLAYER') pWins++;
    }

    // === 评分标准：AI 追求净伤害的最大化 ===
    // Minimax 寻找最高分，所以返回 AI 期望的收益
    
    // 1. 判定胜负
    let finalDamage = rawDamage;
    let winType = 'DRAW';
    
    if (aiWins >= 2) winType = 'AI_WIN';
    else if (pWins >= 2) winType = 'PLAYER_WIN';
    
    // 2. 考虑完胜暴击
    if (aiWins === 3 || pWins === 3) finalDamage *= 2; 

    // 3. 最终收益计算
    if (winType === 'AI_WIN') {
        // AI 赢：获得正分
        return finalDamage;
    } else if (winType === 'PLAYER_WIN') {
        // AI 输：获得负分 (扣血)
        return -finalDamage;
    } else {
        // 平局：伤害进奖池，视为 0 分收益 (不扣血也不赚)
        return 0;
    }
}

// 5. 布阵优化 (保持不变)
export function optimizeHand(hand, rule) {
    if (hand.length < 3) return hand;

    const perms = getAllPermutations(hand);
    const modes = Core.getLaneModes(rule);
    let bestPerm = perms[0];
    let bestScore = -Infinity;

    for (let perm of perms) {
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const val = Core.getCardPoint(perm[i], modes[i]);
            if (modes[i] === 'HIGH') score += val; 
            else score += (15 - val); 
        }
        if (score > bestScore) {
            bestScore = score;
            bestPerm = perm;
        }
    }
    return bestPerm;
}

function getAllPermutations(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) => getAllPermutations(arr.filter((_, j) => j !== i)).map(p => [v, ...p]));
}