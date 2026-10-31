// 骑手钱包单测：提现下限/余额上限/成功冻结/驳回退回/平台级渠道语义（mock 余额端口与仓储）
// F2/F3 并发安全：withdraw 走 rawConnection 事务+Customer 行悲观锁串行化；reject/claim 条件更新防双审双退回
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    // 提现审核原子认领：UPDATE ... WHERE status='PENDING'（条件必须在 where 里，affected=0 即已被处理）
    const qb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
        // 钱包汇总：SUM(PENDING 冻结) / SUM(分成) 走 getRawOne
        select: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ sum: 0 }),
    };
    const repo = {
        save: vi.fn().mockImplementation((v: any) => {
            saved.push(v);
            return Promise.resolve(v);
        }),
        findOne: vi.fn(),
        find: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ affected: 1 }),
        count: vi.fn().mockResolvedValue(0),
        createQueryBuilder: vi.fn(() => qb),
    };
    // em 仓储：rawConnection 事务内使用（Customer 行锁 / PENDING 防重 count / PENDING 落库 save）
    const emRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 9 }),
        count: vi.fn().mockResolvedValue(0),
        save: vi.fn().mockImplementation((v: any) => {
            // 意图单落库后拿到自增 id（扣款流水 remark=withdraw:<id> 的对账锚点）
            const row = { ...v, id: 7 };
            saved.push(row);
            return Promise.resolve(row);
        }),
    };
    const em = {
        query: vi.fn().mockResolvedValue([{ id: 9 }]),
        getRepository: vi.fn(() => emRepo),
    };
    // 补账行级认领：UPDATE rider_earning ... RETURNING id（默认命中一行；[[],[]] 表示已被别处认领）
    const rawQuery = vi.fn().mockResolvedValue([[{ id: 1 }], []]);
    const conn = {
        getRepository: () => repo,
        rawConnection: { transaction: vi.fn((fn: any) => fn(em)), query: rawQuery },
    } as any;
    const reqCtxSvc = { create: vi.fn().mockResolvedValue(platformCtx) } as any;
    return { svc: new RiderWalletService(conn, riderSvc, reqCtxSvc), repo, emRepo, em, saved, reqCtxSvc, conn, qb, rawQuery };
}

describe('RiderWalletService', () => {
    // mocks.port 为模块级共享 spy：清除跨用例调用记录，
    // 避免 not.toHaveBeenCalled 全量断言被前面的成功路径用例污染
    beforeEach(() => {
        mocks.port.getBalance.mockClear();
        mocks.port.deductBalance.mockClear();
        mocks.port.addBalance.mockClear();
    });

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

    it('withdraw 成功：事务内锁 Customer 行 + PENDING 检查后先落意图单，再带 ref 扣款并确认', async () => {
        const { svc, saved, em, repo, qb } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        repo.findOne.mockResolvedValue({
            id: 7, customerId: 9, amount: 2000, status: 'PENDING', withdrawState: 'confirmed', channelId: 1,
        });
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        // F2：先裸 SQL 行锁（SELECT ... FOR UPDATE）串行化同骑手并发
        expect(em.query).toHaveBeenCalledWith('SELECT id FROM customer WHERE id = $1 FOR UPDATE', [9]);
        // R1：意图单先落库（intent），扣款流水 remark 作为对账锚点
        expect(saved).toHaveLength(1);
        expect(saved[0].withdrawState).toBe('intent');
        expect(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000, 'withdraw:7');
        // 扣款成功后 CAS 确认（限定 intent，避免覆盖并发对账结果）
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ withdrawState: 'confirmed' }));
        expect(req!.status).toBe('PENDING');
        expect(req!.amount).toBe(2000);
        expect(req!.customerId).toBe(9);
        expect(req!.channelId).toBe(1);
    });

    it('withdraw 扣款失败：意图单作废（deduct_failed + REJECTED）并抛出', async () => {
        const { svc, qb } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockRejectedValueOnce(new Error('余额不足'));
        await expect(svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' }))
            .rejects.toThrow('余额不足');
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
            withdrawState: 'deduct_failed', status: 'REJECTED',
        }));
        expect(qb.andWhere).toHaveBeenCalledWith('"withdrawState" = :ws', { ws: 'intent' });
    });

    it('withdraw 扣款成功但确认失败：不抛错，留待对账任务收敛', async () => {
        const { svc, repo, qb } = make();
        mocks.port.getBalance.mockResolvedValue(5000);
        mocks.port.deductBalance.mockResolvedValue(3000);
        // 第一次 execute 是确认写（模拟被并发处理），返回 affected=0
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        repo.findOne.mockResolvedValue({ id: 7, customerId: 9, amount: 2000, status: 'PENDING', withdrawState: 'intent', channelId: 1 });
        const req = await svc.riderWithdraw(ctx, { amount: 2000, channel: '支付宝', account: 'a@b.c' });
        expect(mocks.port.deductBalance).toHaveBeenCalledWith(platformCtx, 9, 2000, 'withdraw:7');
        expect(req!.withdrawState).toBe('intent');
    });

    it('reject 解冻退回：先原子认领（REJECTED）再 addBalance(+amount)（资金走默认渠道上下文）', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(ctx, 5 as any, '信息不符');
        // 条件更新：条件必须在 where 里，affected=0 即已被处理
        expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 5 });
        expect(qb.andWhere).toHaveBeenCalledWith('status = :s', { s: 'PENDING' });
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED', remark: '信息不符' }));
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
    });

    it('reject 并发已处理（条件更新 affected=0）抛错且不退回', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(svc.adminReject(ctx, 5 as any, '信息不符')).rejects.toThrow('该申请已处理');
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('approve 并发已处理（条件更新 affected=0）抛错，不会又打款又退款', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(svc.adminApprove(ctx, 5 as any, '已打款', 'TXN-001')).rejects.toThrow('该申请已处理');
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('approve 必填打款流水号：缺失直接抛错且不进入状态更新', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await expect(svc.adminApprove(ctx, 5 as any, '已打款', '   ')).rejects.toThrow('打款流水号');
        expect(qb.execute).not.toHaveBeenCalled();
    });

    it('approve 成功：PAID + 流水号/凭证留痕', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await svc.adminApprove(ctx, 5 as any, '已打款', 'TXN-001', 'https://img.example/p.png');
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({
            status: 'PAID',
            payoutRef: 'TXN-001',
            payoutProof: 'https://img.example/p.png',
        }));
        // 凭证可选：留空落 null
        qb.execute.mockClear();
        await svc.adminApprove(ctx, 5 as any, undefined, 'TXN-002');
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ payoutRef: 'TXN-002', payoutProof: null }));
    });

    it('reject 退回失败：补偿恢复 PENDING 并抛「退回失败」以便重试', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        mocks.port.addBalance.mockRejectedValueOnce(new Error('db down'));
        await expect(svc.adminReject(ctx, 5 as any, '信息不符')).rejects.toThrow('退回失败');
        // 仅当本次认领仍为 REJECTED 时才恢复 PENDING（条件写，防并发改成 PAID 后回滚错状态）
        expect(repo.update).toHaveBeenLastCalledWith(
            { id: 5, status: 'REJECTED' },
            { status: 'PENDING' },
        );
    });

    it('管理端跨渠道可审核：查询不限定 channelId，退回资金固定默认渠道，留痕记审核人', async () => {
        const { svc, repo, qb } = make();
        const adminCtx = { channelId: 2, activeUserId: 7 } as any;
        repo.findOne.mockResolvedValue({ id: 6, customerId: 9, amount: 1000, status: 'PENDING', channelId: 1 });
        await svc.adminReject(adminCtx, 6 as any, '冒烟驳回');
        expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 6 } });
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 1000);
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED', reviewedBy: '7' }));
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

    // P1：补账（pending → 入账）必须行级认领，否则多端并发读钱包会把同一笔分成加两次
    it('补账：认领成功才入账并置 credited（pending 与超时 crediting 都纳入）', async () => {
        const { svc, repo, rawQuery } = make();
        repo.find
            .mockResolvedValueOnce([{ id: 11, amount: 800, status: 'pending' }])
            .mockResolvedValueOnce([]);
        mocks.port.getBalance.mockResolvedValue(0);

        await svc.myRiderWallet(ctx);

        expect(rawQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE rider_earning'),
            ['crediting', 11, 'pending'],
        );
        // 超时 crediting 残留也要重新纳入补账（取 where 条件里的 status）
        expect(repo.find).toHaveBeenLastCalledWith(expect.objectContaining({
            where: expect.objectContaining({ status: 'crediting' }),
        }));
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 800);
        expect(repo.update).toHaveBeenCalledWith(11, { status: 'credited' });
    });

    it('补账：认领未命中（另一路已认领）→ 不入账', async () => {
        const { svc, repo, rawQuery } = make();
        repo.find
            .mockResolvedValueOnce([{ id: 12, amount: 500, status: 'pending' }])
            .mockResolvedValueOnce([]);
        rawQuery.mockResolvedValueOnce([[], []]);
        mocks.port.getBalance.mockResolvedValue(0);

        await svc.myRiderWallet(ctx);

        expect(mocks.port.addBalance).not.toHaveBeenCalled();
        expect(repo.update).not.toHaveBeenCalled();
    });

    it('补账：入账失败回 pending 供下次重试，且中断本轮后续行', async () => {
        const { svc, repo } = make();
        repo.find
            .mockResolvedValueOnce([
                { id: 13, amount: 300, status: 'pending' },
                { id: 14, amount: 200, status: 'pending' },
            ])
            .mockResolvedValueOnce([]);
        mocks.port.addBalance.mockRejectedValueOnce(new Error('port down'));
        mocks.port.getBalance.mockResolvedValue(0);

        await svc.myRiderWallet(ctx);

        expect(repo.update).toHaveBeenCalledWith(13, { status: 'pending' });
        expect(repo.update).not.toHaveBeenCalledWith(14, { status: 'pending' });
        expect(mocks.port.addBalance).toHaveBeenCalledTimes(1);
    });

    // P8：打款失败回退（PAID → FAILED 并退回余额），防「已打款但转账被退回」账实不符
    it('markFailed 必填失败原因：缺失直接抛错且不进入状态更新', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PAID', channelId: 1 });
        await expect(svc.adminMarkFailed(ctx, 5 as any, '   ')).rejects.toThrow('打款失败原因');
        expect(qb.execute).not.toHaveBeenCalled();
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('markFailed 仅 PAID 可回退（PENDING 直接拒绝）', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PENDING', channelId: 1 });
        await expect(svc.adminMarkFailed(ctx, 5 as any, '账号错误')).rejects.toThrow('仅已打款的申请');
        expect(qb.execute).not.toHaveBeenCalled();
    });

    it('markFailed 成功：FAILED + 原因留痕 + 原子认领（WHERE status=PAID）后退回余额', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PAID', channelId: 1 });
        await svc.adminMarkFailed(ctx, 5 as any, '账号被退回');
        expect(qb.where).toHaveBeenCalledWith('id = :id', { id: 5 });
        expect(qb.andWhere).toHaveBeenCalledWith('status = :s', { s: 'PAID' });
        expect(qb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', failReason: '账号被退回' }));
        expect(mocks.port.addBalance).toHaveBeenCalledWith(platformCtx, 9, 2000);
    });

    it('markFailed 并发已处理（affected=0）抛错且不退回', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PAID', channelId: 1 });
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(svc.adminMarkFailed(ctx, 5 as any, '账号错误')).rejects.toThrow('该申请已处理');
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('markFailed 退回失败：补偿恢复 PAID 并抛「退回失败」以便重试', async () => {
        const { svc, repo } = make();
        repo.findOne.mockResolvedValue({ id: 5, customerId: 9, amount: 2000, status: 'PAID', channelId: 1 });
        mocks.port.addBalance.mockRejectedValueOnce(new Error('db down'));
        await expect(svc.adminMarkFailed(ctx, 5 as any, '账号错误')).rejects.toThrow('退回失败');
        expect(repo.update).toHaveBeenLastCalledWith(
            { id: 5, status: 'FAILED' },
            { status: 'PAID' },
        );
    });

    // R1：intent 期间余额尚未确认扣减，禁止打款/驳回（否则错配资金）
    it('审核门槛：扣款未确认（intent）时 approve 拒绝，reject 的条件写排除 intent', async () => {
        const { svc, repo, qb } = make();
        repo.findOne.mockResolvedValue({
            id: 5, customerId: 9, amount: 2000, status: 'PENDING', withdrawState: 'intent', channelId: 1,
        });
        await expect(svc.adminApprove(ctx, 5 as any, '已打款', 'TXN-001')).rejects.toThrow('扣款尚未确认');
        // reject 无法在读取阶段拒绝（并发态由条件写兜底）：模拟条件写未命中
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        await expect(svc.adminReject(ctx, 5 as any, '信息不符')).rejects.toThrow('该申请已处理');
        expect(qb.andWhere).toHaveBeenCalledWith(
            '("withdrawState" IS NULL OR "withdrawState" = :ws)',
            { ws: 'confirmed' },
        );
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    // R1 对账：intent 超时行按流水 remark 还原真实扣款结果
    it('对账：有 withdraw 流水 → 确认（confirmed）', async () => {
        const { svc, repo, qb } = make();
        repo.find.mockResolvedValueOnce([{ id: 21, customerId: 9 }]);
        repo.findOne.mockResolvedValueOnce({ id: 100, remark: 'withdraw:21' });
        const res = await svc.reconcileWithdrawIntents();
        expect(res).toEqual({ confirmed: 1, failed: 0 });
        expect(qb.set).toHaveBeenCalledWith({ withdrawState: 'confirmed' });
        expect(qb.andWhere).toHaveBeenCalledWith('"withdrawState" = :ws', { ws: 'intent' });
    });

    it('对账：无 withdraw 流水 → 作废（deduct_failed + REJECTED），不退回余额', async () => {
        const { svc, repo, qb } = make();
        repo.find.mockResolvedValueOnce([{ id: 22, customerId: 9 }]);
        repo.findOne.mockResolvedValueOnce(null);
        const res = await svc.reconcileWithdrawIntents();
        expect(res).toEqual({ confirmed: 0, failed: 1 });
        expect(qb.set).toHaveBeenCalledWith({
            withdrawState: 'deduct_failed', status: 'REJECTED', remark: '扣款未发生，申请自动作废',
        });
        expect(mocks.port.addBalance).not.toHaveBeenCalled();
    });

    it('对账：并发已被处理（affected=0）→ 不计入统计', async () => {
        const { svc, repo, qb } = make();
        repo.find.mockResolvedValueOnce([{ id: 23, customerId: 9 }]);
        repo.findOne.mockResolvedValueOnce({ id: 101, remark: 'withdraw:23' });
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        const res = await svc.reconcileWithdrawIntents();
        expect(res).toEqual({ confirmed: 0, failed: 0 });
    });
});
