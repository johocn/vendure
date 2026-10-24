import { describe, expect, it, vi } from 'vitest';
import { refundedTotal, settleRefundOrMarkFailed } from './refund-payment';

function makeConn() {
    const qb = {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ sum: '123' }),
    };
    const repo = {
        createQueryBuilder: vi.fn(() => qb),
        update: vi.fn().mockResolvedValue({}),
    };
    return { conn: { rawConnection: { getRepository: vi.fn(() => repo) } } as any, qb, repo };
}

describe('refundedTotal', () => {
    it('已退总额排除 Failed：结算失败未真实打款的退款单不得阻塞重试', async () => {
        const { conn, qb } = makeConn();
        await expect(refundedTotal(conn, 9)).resolves.toBe(123);
        expect(qb.where).toHaveBeenCalledWith('r."paymentId" = :pid', { pid: 9 });
        expect(qb.andWhere).toHaveBeenCalledWith('r.state <> :failed', { failed: 'Failed' });
    });
});

describe('settleRefundOrMarkFailed', () => {
    it('结算成功 → 不置 Failed', async () => {
        const { conn, repo } = makeConn();
        const settleRefund = vi.fn().mockResolvedValue({});
        await settleRefundOrMarkFailed(conn, { settleRefund } as any, {} as any, 55);
        expect(settleRefund).toHaveBeenCalledWith({}, { id: 55 });
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('结算失败 → 置 Failed 并抛出（保留审计痕迹，允许下次重试真实退款）', async () => {
        const { conn, repo } = makeConn();
        const settleRefund = vi.fn().mockRejectedValue(new Error('provider down'));
        await expect(settleRefundOrMarkFailed(conn, { settleRefund } as any, {} as any, 55)).rejects.toThrow('provider down');
        expect(repo.update).toHaveBeenCalledWith(55, { state: 'Failed' });
    });
});
