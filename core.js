// core.js v7.2 (Final Core with Ace Lockdown)

export function createDeck() {
    let deck = [];
    for (let i = 0; i < 4; i++) {
        for (let j = 1; j <= 13; j++) {
            deck.push(j);
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export function getJudgeRule(card) {
    // 奇数审判 (阳) vs 偶数审判 (阴)
    return card % 2 !== 0 ? 'YANG' : 'IN';
}

export function getJudgeMultiplier(card) {
    // 乘数 = 审判牌点数 (A=14)
    return card === 1 ? 14 : card;
}

export function getLaneModes(rule) {
    // 天 / 地 / 人
    return rule === 'YANG' 
        ? ['HIGH', 'LOW', 'HIGH'] 
        : ['LOW', 'HIGH', 'LOW'];
}

export function getCardPoint(card, mode) {
    // A 的特殊点数处理
    if (card === 1) {
        if (!mode) return 1; // 未部署时 A 算 1
        return mode === 'HIGH' ? 14 : 1; // HIGH 算 14，LOW 算 1
    }
    return card;
}

// 核心卡牌比较：加入王牌锁定规则
export function compareLane(pCard, aCard, mode) {
    
    // 判定是否触发【王牌锁定】(A vs J/Q/K)
    const isFaceCard = (card) => card >= 11 && card <= 13;
    const isAce = (card) => card === 1;
    
    const isP_Ace_Lock = isAce(pCard) && isFaceCard(aCard);
    const isA_Ace_Lock = isAce(aCard) && isFaceCard(pCard);
    
    if (isP_Ace_Lock || isA_Ace_Lock) {
        return 'DRAW'; // 强制平局
    }

    const pVal = getCardPoint(pCard, mode);
    const aVal = getCardPoint(aCard, mode);
    
    // 胜负判定
    if (mode === 'HIGH') {
        if (pVal > aVal) return 'PLAYER';
        if (aVal > pVal) return 'AI';
    } else { // LOW mode
        if (pVal < aVal) return 'PLAYER';
        if (aVal < pVal) return 'AI';
    }
    
    return 'DRAW';
}

// 总点数差计算 (用于实际伤害)
export function calculateDamageDifference(pArr, aArr, rule) {
    const modes = getLaneModes(rule);
    let pSum = 0;
    let aSum = 0;

    for (let i = 0; i < 3; i++) {
        pSum += getCardPoint(pArr[i], modes[i]);
        aSum += getCardPoint(aArr[i], modes[i]);
    }
    return Math.abs(pSum - aSum);
}

// 混合点数计算 (用于仪表盘和 Minimax 评分)
export function calculateMixedSum(handArr, slotArr, rule) {
    let sum = 0;
    
    // 1. 未部署手牌（只算面值）
    if (handArr && handArr.length > 0) {
        sum += handArr.reduce((a, b) => a + (b || 0), 0);
    }
    
    // 2. 已部署槽位（算有效点数）
    if (slotArr) {
        const modes = rule ? getLaneModes(rule) : [null, null, null];
        for (let i = 0; i < 3; i++) {
            if (slotArr[i]) sum += getCardPoint(slotArr[i], modes[i]);
        }
    }
    return sum;
}