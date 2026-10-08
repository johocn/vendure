// 骑手钱包单测：提现下限/余额上限/成功冻结/驳回退回/平台级渠道语义（mock 余额端口与仓储）
// F2/F3 并发安全：withdraw 走 rawConnection 事务+Customer 行悲观锁串行化；reject/claim 条件更新防双审双退回
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    port: {
        getBalance: vi.fn(),
        deductBalance: vi.fn(),
        addBalance: vi.fn(),
    },
}));

vi.mock('@vendure/coupon-plugin', () => ({
    getCouponBalancePort: () => mocks.port,
}));

import { RiderWalletService } from './rider-wallet.service';

const ctx = { channelId: 1 } as any;
// platformCtx 模拟默认渠道（RequestContextService.create({ apiType: 'admin' }) 不带 channelToken）
const platformCtx = { channelId: 1, apiType: 'admin' } as any;

function make() {
    const riderSvc = { assertApprovedRider: vi.fn().mockResolvedValue({ id: 9 }) } as any;
    const saved: any[] = [];
    const repo = {
        save: vi.fn().mockImplementation((v: any) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
        findOne: vi.fn(),
        update: vi.fn().mockResolvedValue({ affected: 1 }),
        count: vi.fn().mockResolvedValue(0),
    };
    // em 仓储：rawConnection 事务内使用（Customer 行锁 / PENDING 防重 count / PENDING 落库 save）
    const emRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 9 }),
        count: vi.fn().mockResolvedValue(0),
        save: vi.fn().mockImplementation((v: any) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
    };
    const em = {
        query: vi.fn().mockResolvedValue([{ id: 9 }]),
        getRepository: vi.fn(() => emRepo),
    };
    const conn = {
        getRepository: () => repo,
        rawConnection: { transaction: vi.fn((fn: any) => fn(em)) },
    } as any;
    const reqCtxSvc = { create: vi.fn().mockResolvedValue(platformCtx) } as any;
    return { svc: new RiderWalletService(conn, riderSvc, reqCtxSvc), repo, emRepo, em, saved, reqCtxSvc, conn };
}

describe('RiderWalletService', () => {
    it('withdraw 低于 ¥10 抛错', async () => {
        const { svc } = make();
        mocks.port.getBalance.mockResolvedValue(50000);
        await expect(svc.riderWithdraw(ctx, { amount: 500, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow(
            '最低提现金额为 ¥10',
        );
        expect(mocks.port.deductBalance).not.toHaveBeenCalled();
    });

    it('withdraw 超过可提现余额抛错', async () => {
        const { svc } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        await expect(svc.riderWithdraw(ctx, { amount: 6000, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow(
            '超过可提现余额',
        );
        expect(mocks.port.deductBalance).not.toHaveBeenCalled();
    });

    it('withdraw 成功：事务内锁 Customer 行 + PENDING 检查后扣款冻结落库（资金走默认渠道上下文）', async () => {
        const { svc, saved, em } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        // F2：先裸 SQL 行锁（SELECT ... FOR UPDATE）串行化同骑手并发
        expect(em.query).toHaveBeenCalledWith('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [9]);
        expect(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        expect(req.status).toBe('PENDING');
        expect(req.amount).toBe(2000);
        expect(req.customerId).toBe(9);
        expect(req.channelId).toBe(1);
        expect(saved).toHaveLength(1);
    });

    it('reject 解冻退回：先原子认领（REJECTED）再 addBalance(+amount)（资金走默认渠道上下文）', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(ctx, 5 as any, '信息不符');
        // F3：认领在前，退回在后
        expect(repo.update.mock.calls[0][0]).toBe(5);
        expect(repo.update.mock.calls[0][1]).toEqual(expect.objectContaining({ status: 'REJECTED', remark: '信息不符' }));
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
    });

    it('reject 并发已处理（条件更新 affected=0）抛错且不退回', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        repo.update.mockResolvedValueOnce({ affected: 0 });
        await expect(svc.adminReject(ctx, 5 as any, '信息不符')).rejects.toThrow('该申请已处理');
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('reject 退回失败：补偿恢复 PENDING 并抛「退回失败」以便重试', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        mocks.port.addBalance.mockRejectedValueOnce(new Error('db down'));
        await expect(svc.adminReject(ctx, 5 as any, '信息不符')).rejects.toThrow('退回失败');
        expect(repo.update).toHaveBeenLastCalledWith(5, { status: 'PENDING' });
    });

    it('管理端跨渠道可审核：查询不限定 channelId，退回资金固定默认渠道，留痕记审核人', async () => {
        const { svc, repo } = make();
        const adminCtx = { channelId: 2, activeUserId: 7 } as any;
        repo.findOne.mockResolvedValue({ id: 6, customerId: 9, amount: 1000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(adminCtx, 6 as any, '冒烟驳回');
        expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 6 } });
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 1000);
        expect(repo.update).toHaveBeenCalledWith(
            6,
            expect.objectContaining({ status: 'REJECTED', reviewedBy: '7' }),
        );
    });

    it('withdraw 已有 PENDING 申请时拒绝（事务内防重检查，扣款不发生）', async () => {
        const { svc, emRepo } = make();
        emRepo.count.mockResolvedValue(1);
        mocks.port.getBalance.mockResolvedValue(50000);
        await expect(svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow(
            '您有审核中的提现申请',
        );
        expect(mocks.port.deductBalance).not.toHaveBeenCalled();
    });
});
