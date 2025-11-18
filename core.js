// core.js - 逻辑内核 v2.3 (Fisher-Yates Fix)

// 【核心修正】真·随机洗牌算法 (Fisher-Yates Shuffle)
export function createDeck() {
    let deck = [];
    // 生成标准的 52 张牌
    for (let i = 0; i < 4; i++) {
        for (let j = 1; j <= 13; j++) {
            deck.push(j);
        }
    }
    // 从最后一张开始，随机与前面的交换
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export function getJudgeRule(card) {
    return card % 2 !== 0 ? 'YANG' : 'YIN';
}

// 审判牌 A = 14倍
export function getJudgeMultiplier(card) {
    return card === 1 ? 14 : card;
}

export function getLaneModes(rule) {
    return rule === 'YANG' 
        ? ['HIGH', 'LOW', 'HIGH'] 
        : ['LOW', 'HIGH', 'LOW'];
}

// 单卡点数计算 (A 在不同规则下的变化)
export function getCardPoint(card, mode) {
    if (card === 1) {
        // 抢牌阶段或无规则时，A 默认为 1 (最小潜力)
        if (!mode) return 1;
        return mode === 'HIGH' ? 14 : 1;
    }
    return card;
}

export function compareLane(pCard, aCard, mode) {
    const pVal = getCardPoint(pCard, mode);
    const aVal = getCardPoint(aCard, mode);

    if (mode === 'HIGH') {
        return pVal > aVal ? 'PLAYER' : (pVal < aVal ? 'AI' : 'DRAW');
    } else {
        return pVal < aVal ? 'PLAYER' : (pVal > aVal ? 'AI' : 'DRAW');
    }
}

// 【核心修正】混合求和：绝对不会归零
// handArr: 手里的牌 (数组)
// slotArr: 槽里的牌 (数组 [val, null, val])
// rule: 当前规则
export function calculateMixedSum(handArr, slotArr, rule) {
    let sum = 0;
    
    // 1. 算手里的牌 (永远按面值/A=1 计算，保持基础分)
    if (handArr && handArr.length > 0) {
        sum += handArr.reduce((a, b) => a + (b || 0), 0);
    }

    // 2. 算槽里的牌 (按规则变化)
    if (slotArr) {
        const modes = rule ? getLaneModes(rule) : [null, null, null];
        for (let i = 0; i < 3; i++) {
            const card = slotArr[i];
            if (card !== null && card !== undefined && !isNaN(card)) {
                // 如果有规则，A 会变身；没规则，A=1
                sum += getCardPoint(card, modes[i]);
            }
        }
    }
    
    return sum;
}