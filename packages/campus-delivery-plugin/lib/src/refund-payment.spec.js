"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const refund_payment_1 = require("./refund-payment");
/** 伪连接：Payment 走 find，Refund 走聚合查询（按 paymentId 回放已退总额） */
function mkConn(payments, refundedByPayment = {}) {
    let currentId;
    return {
        rawConnection: {
            getRepository: (ent) => {
                if ((ent === null || ent === void 0 ? void 0 : ent.name) === 'Payment')
                    return { find: async () => payments };
                return {
                    createQueryBuilder: () => {
                        const qb = {
                            select: () => qb,
                            where: (_sql, params) => {
                                currentId = params === null || params === void 0 ? void 0 : params.pid;
                                return qb;
                            },
                            getRawOne: async () => { var _a; return ({ sum: String((_a = refundedByPayment[currentId]) !== null && _a !== void 0 ? _a : 0) }); },
                        };
                        return qb;
                    },
                };
            },
        },
    };
}
(0, vitest_1.describe)('refundablePayments', () => {
    (0, vitest_1.it)('只保留 Settled/Authorized 且有余额的支付单', async () => {
        const conn = mkConn([
            { id: 3, amount: 1000, state: 'Settled' },
            { id: 2, amount: 1000, state: 'Declined' },
            { id: 1, amount: 500, state: 'Settled' },
        ], { 3: 0, 1: 500 });
        const out = await (0, refund_payment_1.refundablePayments)(conn, 9);
        (0, vitest_1.expect)(out.map(p => p.payment.id)).toEqual([3]);
        (0, vitest_1.expect)(out[0].remaining).toBe(1000);
    });
    (0, vitest_1.it)('失败重试单不参与退款（避免选中 Declined 单）', async () => {
        const conn = mkConn([{ id: 5, amount: 800, state: 'Error' }]);
        (0, vitest_1.expect)(await (0, refund_payment_1.refundablePayments)(conn, 9)).toEqual([]);
        (0, vitest_1.expect)(await (0, refund_payment_1.pickRefundablePayment)(conn, 9)).toBeNull();
    });
    (0, vitest_1.it)('部分已退 → remaining 按已退总额扣减', async () => {
        const conn = mkConn([{ id: 7, amount: 2000, state: 'Authorized' }], { 7: 500 });
        const out = await (0, refund_payment_1.pickRefundablePayment)(conn, 9, 1500);
        (0, vitest_1.expect)(out === null || out === void 0 ? void 0 : out.remaining).toBe(1500);
    });
    (0, vitest_1.it)('needAmount 超过单张余额 → 返回 null', async () => {
        const conn = mkConn([{ id: 7, amount: 2000, state: 'Settled' }], { 7: 1800 });
        (0, vitest_1.expect)(await (0, refund_payment_1.pickRefundablePayment)(conn, 9, 500)).toBeNull();
    });
});
//# sourceMappingURL=refund-payment.spec.js.map