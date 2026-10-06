// 骑手钱包单测：提现下限/余额上限/成功冻结/驳回退回/平台级渠道语义（mock 余额端口与仓储）
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
        update: vi.fn().mockResolvedValue({}),
    };
    const conn = { getRepository: () => repo } as any;
    const reqCtxSvc = { create: vi.fn().mockResolvedValue(platformCtx) } as any;
    return { svc: new RiderWalletService(conn, riderSvc, reqCtxSvc), repo, saved, reqCtxSvc };
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

    it('withdraw 成功：创建 PENDING 申请并扣款冻结（资金走默认渠道上下文）', async () => {
        const { svc, saved } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        expect(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        expect(req.status).toBe('PENDING');
        expect(req.amount).toBe(2000);
        expect(req.customerId).toBe(9);
        expect(req.channelId).toBe(1);
        expect(saved).toHaveLength(1);
    });

    it('reject 解冻退回：addBalance(+amount) 且状态 REJECTED（资金走默认渠道上下文）', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(ctx, 5 as any, '信息不符');
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        expect(repo.update).toHaveBeenCalledWith(
            5,
            expect.objectContaining({ status: 'REJECTED', remark: '信息不符' }),
        );
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
});
