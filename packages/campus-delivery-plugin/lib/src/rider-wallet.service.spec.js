"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 骑手钱包单测：提现下限/余额上限/成功冻结/驳回退回/平台级渠道语义（mock 余额端口与仓储）
// F2/F3 并发安全：withdraw 走 rawConnection 事务+Customer 行悲观锁串行化；reject/claim 条件更新防双审双退回
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
        update: vitest_1.vi.fn().mockResolvedValue({ affected: 1 }),
        count: vitest_1.vi.fn().mockResolvedValue(0),
    };
    // em 仓储：rawConnection 事务内使用（Customer 行锁 / PENDING 防重 count / PENDING 落库 save）
    const emRepo = {
        findOne: vitest_1.vi.fn().mockResolvedValue({ id: 9 }),
        count: vitest_1.vi.fn().mockResolvedValue(0),
        save: vitest_1.vi.fn().mockImplementation((v) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
    };
    const em = {
        query: vitest_1.vi.fn().mockResolvedValue([{ id: 9 }]),
        getRepository: vitest_1.vi.fn(() => emRepo),
    };
    const conn = {
        getRepository: () => repo,
        rawConnection: { transaction: vitest_1.vi.fn((fn) => fn(em)) },
    };
    const reqCtxSvc = { create: vitest_1.vi.fn().mockResolvedValue(platformCtx) };
    return { svc: new rider_wallet_service_1.RiderWalletService(conn, riderSvc, reqCtxSvc), repo, emRepo, em, saved, reqCtxSvc, conn };
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
    (0, vitest_1.it)('withdraw 成功：事务内锁 Customer 行 + PENDING 检查后扣款冻结落库（资金走默认渠道上下文）', async () => {
        const { svc, saved, em } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        // F2：先裸 SQL 行锁（SELECT ... FOR UPDATE）串行化同骑手并发
        (0, vitest_1.expect)(em.query).toHaveBeenCalledWith('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [9]);
        (0, vitest_1.expect)(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
        (0, vitest_1.expect)(req.status).toBe('PENDING');
        (0, vitest_1.expect)(req.amount).toBe(2000);
        (0, vitest_1.expect)(req.customerId).toBe(9);
        (0, vitest_1.expect)(req.channelId).toBe(1);
        (0, vitest_1.expect)(saved).toHaveLength(1);
    });
    (0, vitest_1.it)('reject 解冻退回：先原子认领（REJECTED）再 addBalance(+amount)（资金走默认渠道上下文）', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(ctx, 5, '信息不符');
        // F3：认领在前，退回在后
        (0, vitest_1.expect)(repo.update.mock.calls[0][0]).toBe(5);
        (0, vitest_1.expect)(repo.update.mock.calls[0][1]).toEqual(vitest_1.expect.objectContaining({ status: 'REJECTED', remark: '信息不符' }));
        (0, vitest_1.expect)(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
    });
    (0, vitest_1.it)('reject 并发已处理（条件更新 affected=0）抛错且不退回', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        repo.update.mockResolvedValueOnce({ affected: 0 });
        await (0, vitest_1.expect)(svc.adminReject(ctx, 5, '信息不符')).rejects.toThrow('该申请已处理');
        (0, vitest_1.expect)(mocks.port.addBalance).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('reject 退回失败：补偿恢复 PENDING 并抛「退回失败」以便重试', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        mocks.port.addBalance.mockRejectedValueOnce(new Error('db down'));
        await (0, vitest_1.expect)(svc.adminReject(ctx, 5, '信息不符')).rejects.toThrow('退回失败');
        (0, vitest_1.expect)(repo.update).toHaveBeenLastCalledWith(5, { status: 'PENDING' });
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
    (0, vitest_1.it)('withdraw 已有 PENDING 申请时拒绝（事务内防重检查，扣款不发生）', async () => {
        const { svc, emRepo } = make();
        emRepo.count.mockResolvedValue(1);
        mocks.port.getBalance.mockResolvedValue(50000);
        await (0, vitest_1.expect)(svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' })).rejects.toThrow('您有审核中的提现申请');
        (0, vitest_1.expect)(mocks.port.deductBalance).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=rider-wallet.service.spec.js.map