"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffOrder = diffOrder;
/**
 * 四流逐单比对：
 * D1 缺配送记录：已发货/已交付订单必须有 mode∈{self,express,pickup} 且非 Draft 的记录
 * D2 扣仓不一致：账本 order:out 仓与配送记录 sourceLocationId 必须一致
 * D3 金额不平：台账应收合计（PAID 实收 + PENDING_SIGN 在途）≠ 订单应付；退款单跳过
 * D4 镜像不平：虚拟仓 onHand ≠ Σ 绑定物理仓 onHand（由批次扫描传入）
 */
function diffOrder(input) {
    var _a, _b;
    const diffs = [];
    const { order, deliveryRecords, ledgerOuts, settlements, mirrorDiff, cancelled } = input;
    const openRecords = deliveryRecords.filter(r => ['self', 'express', 'pickup'].includes(r.mode) && r.status !== 'Draft');
    if (openRecords.length === 0) {
        diffs.push('D1');
    }
    const firstOut = ledgerOuts[0];
    if (firstOut) {
        const recLoc = (_b = (_a = openRecords.find(r => r.sourceLocationId)) === null || _a === void 0 ? void 0 : _a.sourceLocationId) !== null && _b !== void 0 ? _b : null;
        if (recLoc == null || String(recLoc) !== String(firstOut.sourceLocationId)) {
            diffs.push('D2');
        }
    }
    if (!cancelled) {
        // COD（PENDING_SIGN）为在途应收，计入台账总额；仅当台账应收合计与订单应付不等才判 D3
        const settledAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
        if (settledAmount !== order.totalWithTax) {
            diffs.push('D3');
        }
    }
    if (mirrorDiff !== 0) {
        diffs.push('D4');
    }
    return diffs;
}
//# sourceMappingURL=diff-rules.js.map