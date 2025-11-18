import * as Core from './core.js';

// 1. 死缓决策：AI 的性格逻辑
export function getDebtAction(aiHP, aiDebt) {
    // 如果债很少，直接还，保持健康
    if (aiDebt < 20) return 'PAY';
    
    // 如果血量危险，或者这把要是输了就得死，那就拼死一搏
    if (aiHP < 60 || aiDebt >= 100) return 'DOUBLE';

    // 优势局贪婪：血量健康，想贪一把清零
    if (aiHP > 100 && aiDebt < 50) return 'DOUBLE';

    return 'PAY';
}

// 2. 抢牌入口 (God Mode)
export function getBestDraft(pool, aiHand, pHand) {
    // 开启全深度搜索
    // alpha-beta 剪枝初始值
    const result = minimax(pool, aiHand, pHand, true, -Infinity, Infinity);
    console.log(`AI 推演结果: 预计收益 ${result.score}, 最佳策略: ${result.card}`);
    
    // 如果找不到最优解（极罕见），随便拿第一张
    return result.card || pool[0];
}

// === 核心：全深度极小极大算法 (Full-Depth Minimax) ===
// 暴力推演这局游戏剩下的所有可能性，直到只剩一张审判牌
function minimax(pool, aiHand, pHand, isAiTurn, alpha, beta) {
    // 【终止条件】：池子里只剩 1 张牌，这就是审判牌
    if (pool.length === 1) {
        const judgeCard = pool[0];
        // 计算最终局面的净胜分
        const finalScore = evaluateFinalState(judgeCard, aiHand, pHand);
        return { score: finalScore, card: null };
    }

    let bestMove = null;

    if (isAiTurn) {
        // AI 回合：寻找【最大】收益
        let maxEval = -Infinity;
        
        for (let card of pool) {
            // 模拟：AI 拿走这张牌
            const remainingPool = pool.filter(c => c !== card);
            const nextHand = [...aiHand, card];
            
            // 递归进入下一层（轮到玩家）
            const evalObj = minimax(remainingPool, nextHand, pHand, false, alpha, beta);
            
            if (evalObj.score > maxEval) {
                maxEval = evalObj.score;
                bestMove = card;
            }
            
            // Alpha-Beta 剪枝优化
            alpha = Math.max(alpha, evalObj.score);
            if (beta <= alpha) break; 
        }
        return { score: maxEval, card: bestMove };
        
    } else {
        // 玩家回合：AI 假设玩家也是绝顶高手，会寻找让 AI 收益【最小】的走法
        let minEval = Infinity;
        
        for (let card of pool) {
            // 模拟：玩家拿走这张牌
            const remainingPool = pool.filter(c => c !== card);
            const nextHand = [...pHand, card];
            
            // 递归进入下一层（轮到 AI）
            const evalObj = minimax(remainingPool, aiHand, nextHand, true, alpha, beta);
            
            if (evalObj.score < minEval) {
                minEval = evalObj.score;
                bestMove = card;
            }
            
            beta = Math.min(beta, evalObj.score);
            if (beta <= alpha) break;
        }
        return { score: minEval, card: bestMove };
    }
}

// 3. 终局估值函数
function evaluateFinalState(judgeCard, aiHand, pHand) {
    const rule = Core.getJudgeRule(judgeCard);
    const multiplier = Core.getJudgeMultiplier(judgeCard);
    
    // AI 和 玩家都使用最优布阵
    const aiArr = optimizeHand(aiHand, rule);
    const pArr = optimizeHand(pHand, rule); // 假设玩家也会玩得最好
    
    // 模拟战斗
    const modes = Core.getLaneModes(rule);
    let aiWins = 0;
    let pWins = 0;
    
    // 计算总点数差（用于伤害计算）
    const aiTotal = Core.calculateMixedSum([], aiArr, rule);
    const pTotal = Core.calculateMixedSum([], pArr, rule);
    let rawDamage = Math.abs(aiTotal - pTotal) * multiplier;

    for (let i = 0; i < 3; i++) {
        const res = Core.compareLane(pArr[i], aiArr[i], modes[i]);
        if (res === 'AI') aiWins++;
        if (res === 'PLAYER') pWins++;
    }

    // === 评分标准 ===
    // 正分代表 AI 赢，负分代表 AI 输
    // 分数大小代表伤害值
    
    if (aiWins > pWins) {
        // AI 赢
        if (aiWins === 3) rawDamage *= 2; // 考虑完胜暴击
        return rawDamage; 
    } else if (pWins > aiWins) {
        // AI 输
        if (pWins === 3) rawDamage *= 2;
        return -rawDamage; // 返回负分，AI 会尽量避免这个结果
    } else {
        return 0; // 平局
    }
}

// 4. 布阵优化 (暴力全排列)
export function optimizeHand(hand, rule) {
    // 如果牌不够3张（理论上不会发生，但为了健壮性），补全
    if (hand.length < 3) return hand;

    const perms = getAllPermutations(hand);
    const modes = Core.getLaneModes(rule);
    
    let bestPerm = perms[0];
    let bestScore = -Infinity;

    // AI 在布阵时，不知道对手怎么摆，所以这里只能采取“最大化自身胜率”的策略
    // 简单的贪心策略：让自己的牌在对应规则下尽可能大/小
    // 但这不够聪明。更好的策略是：假设对手拿的是“平均牌”进行对撞。
    // 简版 V3：最大化自己的点数优势
    
    for (let perm of perms) {
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const val = Core.getCardPoint(perm[i], modes[i]);
            
            // 在 HIGH 规则下，点数越大越好
            // 在 LOW 规则下，点数越小越好 (但 A=1 已经是最小了)
            // 注意：这里我们只是为了选出一个最优排列，不涉及跟对手比
            
            // 稍微复杂的启发式：
            // 如果是比大，14分(A) > 13分(K)
            // 如果是比小，1分(A) 是最强的，相当于 14分的权重
            
            if (modes[i] === 'HIGH') {
                score += val; 
            } else {
                // 比小：牌越小分越高。 A(1) -> 14分, 2 -> 13分 ... 13 -> 1分
                score += (15 - val); 
            }
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