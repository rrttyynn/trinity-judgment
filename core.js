// core.js v6.0 (Pure Number Logic)

export function createDeck() {
    let deck = [];
    // 牌库只生成整数 1-13
    for (let i = 0; i < 4; i++) {
        for (let j = 1; j <= 13; j++) {
            deck.push(j);
        }
    }
    // Fisher-Yates 洗牌
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export function getJudgeRule(card) {
    // 依然按点数定奇偶
    return card % 2 !== 0 ? 'YANG' : 'YIN';
}

export function getJudgeMultiplier(card) {
    return card === 1 ? 14 : card;
}

export function getLaneModes(rule) {
    return rule === 'YANG' 
        ? ['HIGH', 'LOW', 'HIGH'] 
        : ['LOW', 'HIGH', 'LOW'];
}

export function getCardPoint(card, mode) {
    if (card === 1) {
        if (!mode) return 1;
        return mode === 'HIGH' ? 14 : 1;
    }
    return card;
}

export function compareLane(pCard, aCard, mode) {
    const pVal = getCardPoint(pCard, mode);
    const aVal = getCardPoint(aCard, mode);
    if (mode === 'HIGH') return pVal > aVal ? 'PLAYER' : (pVal < aVal ? 'AI' : 'DRAW');
    else return pVal < aVal ? 'PLAYER' : (pVal > aVal ? 'AI' : 'DRAW');
}

// 计算混合总分 (手牌 + 槽位，都为整数)
export function calculateMixedSum(handArr, slotArr, rule) {
    let sum = 0;
    // 1. 算手里的牌 (按面值/A=1 计算)
    if (handArr && handArr.length > 0) {
        sum += handArr.reduce((a, b) => a + (b || 0), 0);
    }
    // 2. 算槽里的牌 (按规则变化)
    if (slotArr) {
        const modes = rule ? getLaneModes(rule) : [null, null, null];
        for (let i = 0; i < 3; i++) {
            if (slotArr[i]) sum += getCardPoint(slotArr[i], modes[i]);
        }
    }
    return sum;
}

// 【删除】analyzeClass 函数