import { describe, expect, it } from 'vitest';
import { pickRefundablePayment, refundablePayments } from './refund-payment';

/** 伪连接：Payment 走 find，Refund 走聚合查询（按 paymentId 回放已退总额） */
function mkConn(payments: any[], refundedByPayment: Record<string, number> = {}) {
    let currentId: any;
    return {
        rawConnection: {
            getRepository: (ent: any) => {
                if ((ent as any)?.name === 'Payment') return { find: async () => payments };
                return {
                    createQueryBuilder: () => {
                        const qb: any = {
                            select: () => qb,
                            where: (_sql: string, params: any) => {
                                currentId = params?.pid;
                                return qb;
                            },
                            getRawOne: async () => ({ sum: String(refundedByPayment[currentId] ?? 0) }),
                        };
                        return qb;
                    },
                };
            },
        },
    } as any;
}

describe('refundablePayments', () => {
    it('只保留 Settled/Authorized 且有余额的支付单', async () => {
        const conn = mkConn(
            [
                { id: 3, amount: 1000, state: 'Settled' },
                { id: 2, amount: 1000, state: 'Declined' },
                { id: 1, amount: 500, state: 'Settled' },
            ],
            { 3: 0, 1: 500 },
        );
        const out = await refundablePayments(conn, 9);
        expect(out.map(p => p.payment.id)).toEqual([3]);
        expect(out[0].remaining).toBe(1000);
    });

    it('失败重试单不参与退款（避免选中 Declined 单）', async () => {
        const conn = mkConn([{ id: 5, amount: 800, state: 'Error' }]);
        expect(await refundablePayments(conn, 9)).toEqual([]);
        expect(await pickRefundablePayment(conn, 9)).toBeNull();
    });

    it('部分已退 → remaining 按已退总额扣减', async () => {
        const conn = mkConn([{ id: 7, amount: 2000, state: 'Authorized' }], { 7: 500 });
        const out = await pickRefundablePayment(conn, 9, 1500);
        expect(out?.remaining).toBe(1500);
    });

    it('needAmount 超过单张余额 → 返回 null', async () => {
        const conn = mkConn([{ id: 7, amount: 2000, state: 'Settled' }], { 7: 1800 });
        expect(await pickRefundablePayment(conn, 9, 500)).toBeNull();
    });
});
