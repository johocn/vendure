"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 骑手钱包单测：提现下限/余额上限/成功冻结/驳回退回/平台级渠道语义（mock 余额端口与仓储）
const vitest_1 = require("vitest");
const mocks = vitest_1.vi.hoisted(() => ({
    port: {
        getBalance: vitest_1.vi.fn(),
        deductBalance: vitest_1.vi.fn(),
        addBalance: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('@vendure/coupon-plugin', () => ({
    getCouponBalancePort: () => mocks.port,
}));
const rider_wallet_service_1 = require("./rider-wallet.service");
const ctx = { channelId: 1 };
// platformCtx 模拟默认渠道（RequestContextService.create({ apiType: 'admin' }) 不带 channelToken）
const platformCtx = { channelId: 1, apiType: 'admin' };
function make() {
    const riderSvc = { assertApprovedRider: vitest_1.vi.fn().mockResolvedValue({ id: 9 }) };
    const saved = [];
    const repo = {
        save: vitest_1.vi.fn().mockImplementation((v) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
        findOne: vitest_1.vi.fn(),
        update: vitest_1.vi.fn().mockResolvedValue({}),
    };
    const conn = { getRepository: () => repo };
    const reqCtxSvc = { create: vitest_1.vi.fn().mockResolvedValue(platformCtx) };
    return { svc: new rider_wallet_service_1.RiderWalletService(conn, riderSvc, reqCtxSvc), repo, saved, reqCtxSvc };
}
(0, vitest_1.describe)('RiderWalletService', () => {
    (0, vitest_1.it)('withdraw 低于 ¥10 抛错', async () => {
        const { svc } = make();
        mocks.port.getBalance.mockResolvedValue(50000);
        await (0, vitest_1.expect)(svc.riderWithdraw(ctx, { amount: 500, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow('最低提现金额为 ¥10');
        (0, vitest_1.expect)(mocks.port.deductBalance).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('withdraw 超过可提现余额抛错', async () => {
        const { svc } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        await (0, vitest_1.expect)(svc.riderWithdraw(ctx, { amount: 6000, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow('超过可提现余额');
        (0, vitest_1.expect)(mocks.port.deductBalance).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('withdraw 成功：创建 PENDING 申请并扣款冻结（资金走默认渠道上下文）', async () => {
        const { svc, saved } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        (0, vitest_1.expect)(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        (0, vitest_1.expect)(req.status).toBe('PENDING');
        (0, vitest_1.expect)(req.amount).toBe(2000);
        (0, vitest_1.expect)(req.customerId).toBe(9);
        (0, vitest_1.expect)(req.channelId).toBe(1);
        (0, vitest_1.expect)(saved).toHaveLength(1);
    });
    (0, vitest_1.it)('reject 解冻退回：addBalance(+amount) 且状态 REJECTED（资金走默认渠道上下文）', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(ctx, 5, '信息不符');
        (0, vitest_1.expect)(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        (0, vitest_1.expect)(repo.update).toHaveBeenCalledWith(5, vitest_1.expect.objectContaining({ status: 'REJECTED', remark: '信息不符' }));
    });
    (0, vitest_1.it)('管理端跨渠道可审核：查询不限定 channelId，退回资金固定默认渠道，留痕记审核人', async () => {
        const { svc, repo } = make();
        const adminCtx = { channelId: 2, activeUserId: 7 };
        repo.findOne.mockResolvedValue({ id: 6, customerId: 9, amount: 1000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(adminCtx, 6, '冒烟驳回');
        (0, vitest_1.expect)(repo.findOne).toHaveBeenCalledWith({ where: { id: 6 } });
        (0, vitest_1.expect)(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 1000);
        (0, vitest_1.expect)(repo.update).toHaveBeenCalledWith(6, vitest_1.expect.objectContaining({ status: 'REJECTED', reviewedBy: '7' }));
    });
});
//# sourceMappingURL=rider-wallet.service.spec.js.map