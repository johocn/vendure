"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// 使模块命名空间可 spy（覆盖 resolveSettlementAdapter 注入故障适配器）
vitest_1.vi.mock('./coupon-settlement-adapter', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual);
});
const coupon_settlement_adapter_1 = require("./coupon-settlement-adapter");
const coupon_settlement_order_entity_1 = require("./coupon-settlement-order.entity");
const coupon_settlement_service_1 = require("./coupon-settlement.service");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
(0, vitest_1.describe)('computeSettlementAmounts 佣金/净付额', () => {
    (0, vitest_1.it)('5% 佣金：面额 ¥100 → 佣金 ¥5 / 净付 ¥95', () => {
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.computeSettlementAmounts)(10000, 500)).toEqual({ commissionAmount: 500, netAmount: 9500 });
    });
    (0, vitest_1.it)('零头向下取整：面额 33 分 × 3.33%（333bp）→ 佣金 1 分', () => {
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.computeSettlementAmounts)(33, 333)).toEqual({ commissionAmount: 1, netAmount: 32 });
    });
    (0, vitest_1.it)('费率 0 = 平台暂不分佣（P0 默认）', () => {
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.computeSettlementAmounts)(10000, 0)).toEqual({ commissionAmount: 0, netAmount: 10000 });
    });
    (0, vitest_1.it)('负数/非数输入按 0 兜底', () => {
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.computeSettlementAmounts)(-5, 500).netAmount).toBe(0);
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.computeSettlementAmounts)(Number.NaN, 500).netAmount).toBe(0);
    });
});
(0, vitest_1.describe)('结算单号（分账幂等键）', () => {
    (0, vitest_1.it)('确定性生成：CSTL-{channelId}-{customerCouponId}', () => {
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.buildSettlementNo)(7, 12345)).toBe('CSTL-7-12345');
    });
});
(0, vitest_1.describe)('resolveSettlementAdapter 模式开关（风险铁律①）', () => {
    const originalMode = process.env.COUPON_SPLIT_MODE;
    (0, vitest_1.afterEach)(() => {
        if (originalMode === undefined)
            delete process.env.COUPON_SPLIT_MODE;
        else
            process.env.COUPON_SPLIT_MODE = originalMode;
    });
    (0, vitest_1.it)('默认/stub → stub 适配器，回执号带幂等键', async () => {
        delete process.env.COUPON_SPLIT_MODE;
        const adapter = (0, coupon_settlement_adapter_1.resolveSettlementAdapter)();
        (0, vitest_1.expect)(adapter.mode).toBe('stub');
        const res = await adapter.submitSplit({ settlementNo: 'CSTL-7-1' }, 'CSTL-7-1');
        (0, vitest_1.expect)(res.accepted).toBe(true);
        (0, vitest_1.expect)(res.receiptNo).toBe('STUB-CSTL-7-1');
        (0, vitest_1.expect)((await adapter.queryReceipt('any')).state).toBe('FINISHED');
    });
    (0, vitest_1.it)('wechat 实联未持合规结论 → 明确拒绝（不静默回落 stub）', () => {
        process.env.COUPON_SPLIT_MODE = 'wechat';
        (0, vitest_1.expect)(() => (0, coupon_settlement_adapter_1.resolveSettlementAdapter)()).toThrow(/compliance approval/);
    });
    (0, vitest_1.it)('未知模式 → 回落 stub', () => {
        process.env.COUPON_SPLIT_MODE = 'mystery';
        (0, vitest_1.expect)((0, coupon_settlement_adapter_1.resolveSettlementAdapter)().mode).toBe('stub');
    });
});
/**
 * runSettlementCycle（T+1 汇总 job）核心不变量（风险铁律②④）：
 * - 提交查询 SQL 下推：status=PENDING + attempts 上限 + createdAt T+1 界线（Date 参数绑定）
 * - 状态推进全部带原状态条件原子更新
 * - backfill 查询排除已登记（LEFT JOIN s.id IS NULL）且日期用 Date 绑定
 */
(0, vitest_1.describe)('CouponSettlementService.runSettlementCycle', () => {
    const ctx = { channelId: 7 };
    let selectQb;
    let updateQb;
    let settleRepo;
    let billRepo;
    let service;
    (0, vitest_1.beforeEach)(() => {
        selectQb = {
            select: vitest_1.vi.fn().mockReturnThis(),
            addSelect: vitest_1.vi.fn().mockReturnThis(),
            innerJoin: vitest_1.vi.fn().mockReturnThis(),
            leftJoin: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            andWhere: vitest_1.vi.fn().mockReturnThis(),
            orderBy: vitest_1.vi.fn().mockReturnThis(),
            take: vitest_1.vi.fn().mockReturnThis(),
            getRawMany: vitest_1.vi.fn(async () => []),
            getMany: vitest_1.vi.fn(async () => []),
            update: vitest_1.vi.fn().mockReturnThis(),
            set: vitest_1.vi.fn().mockReturnThis(),
            execute: vitest_1.vi.fn(async () => ({ affected: 1 })),
        };
        updateQb = selectQb;
        settleRepo = {
            createQueryBuilder: vitest_1.vi.fn(() => selectQb),
            find: vitest_1.vi.fn(async () => []),
            save: vitest_1.vi.fn(async (r) => r),
        };
        billRepo = { createQueryBuilder: vitest_1.vi.fn(() => selectQb) };
        const connection = {
            rawConnection: {
                getRepository: vitest_1.vi.fn((entity) => {
                    if (entity === in_store_bill_entity_1.InStoreBill)
                        return billRepo;
                    return settleRepo;
                }),
            },
            getRepository: vitest_1.vi.fn(() => settleRepo),
        };
        service = new coupon_settlement_service_1.CouponSettlementService(connection);
        vitest_1.vi.spyOn(service, 'settlementCutoff').mockReturnValue(new Date('2026-10-19T00:00:00'));
    });
    (0, vitest_1.it)('提交查询 SQL 下推：PENDING + attempts 上限 + T+1 界线（Date 绑定，非字符串比较）', async () => {
        await service.runSettlementCycle();
        // 提交查询：where('s.status = :status'...) + andWhere attempts + andWhere createdAt
        (0, vitest_1.expect)(selectQb.where).toHaveBeenCalledWith('s.status = :status', { status: 'PENDING' });
        (0, vitest_1.expect)(selectQb.andWhere).toHaveBeenCalledWith('s.attempts < :max', vitest_1.expect.objectContaining({ max: vitest_1.expect.any(Number) }));
        const cutoffCall = selectQb.andWhere.mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('s.createdAt'));
        (0, vitest_1.expect)(cutoffCall).toBeTruthy();
        (0, vitest_1.expect)(cutoffCall[1].cutoff).toBeInstanceOf(Date);
        (0, vitest_1.expect)(cutoffCall[1].cutoff.toISOString()).toBe('2026-10-18T16:00:00.000Z'); // 东八区零点
    });
    (0, vitest_1.it)('提交成功 → 带原状态条件原子更新为 SETTLED（含回执号与模式快照）', async () => {
        const row = { id: 1, status: 'PENDING', attempts: 0, settlementNo: 'CSTL-7-1' };
        selectQb.getMany.mockResolvedValueOnce([row]);
        await service.runSettlementCycle();
        // 抢占更新：attempts + 1（带 status=PENDING 条件）
        (0, vitest_1.expect)(selectQb.update).toHaveBeenCalledWith(coupon_settlement_order_entity_1.CouponSettlementOrder);
        (0, vitest_1.expect)(selectQb.where).toHaveBeenCalledWith('id = :id AND status = :status', { id: 1, status: 'PENDING' });
        // 置 SETTLED：同样带 PENDING 条件
        (0, vitest_1.expect)(selectQb.set).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'SETTLED', splitMode: 'stub', splitReceiptNo: 'STUB-CSTL-7-1' }));
    });
    (0, vitest_1.it)('提交抛错 → 留在 PENDING 记录 lastError（进重试队列）', async () => {
        const row = { id: 2, status: 'PENDING', attempts: 0, settlementNo: 'CSTL-7-2' };
        selectQb.getMany.mockResolvedValueOnce([row]);
        const adapterModule = await import('./coupon-settlement-adapter.js');
        const spy = vitest_1.vi.spyOn(adapterModule, 'resolveSettlementAdapter').mockReturnValue({
            mode: 'stub',
            submitSplit: vitest_1.vi.fn(async () => {
                throw new Error('gateway down');
            }),
            queryReceipt: vitest_1.vi.fn(async () => ({ state: 'PROCESSING' })),
            refundSplit: vitest_1.vi.fn(async () => ({ accepted: true })),
        });
        const r = await service.runSettlementCycle();
        (0, vitest_1.expect)(r.submitted).toBe(0);
        const errCall = selectQb.set.mock.calls.find((c) => { var _a; return 'lastError' in ((_a = c[0]) !== null && _a !== void 0 ? _a : {}); });
        (0, vitest_1.expect)(errCall).toBeTruthy();
        (0, vitest_1.expect)(errCall[0].lastError).toContain('gateway down');
        spy.mockRestore();
    });
    (0, vitest_1.it)('回执 FINISHED → 带原状态条件推进 PAID_OUT', async () => {
        settleRepo.find.mockResolvedValueOnce([
            { id: 3, status: 'SETTLED', settlementNo: 'CSTL-7-3', splitReceiptNo: 'STUB-CSTL-7-3' },
        ]);
        const r = await service.runSettlementCycle();
        (0, vitest_1.expect)(r.promoted).toBe(1);
        (0, vitest_1.expect)(selectQb.set).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'PAID_OUT' }));
        (0, vitest_1.expect)(selectQb.where).toHaveBeenCalledWith('id = :id AND status = :status', { id: 3, status: 'SETTLED' });
    });
});
(0, vitest_1.describe)('CouponSettlementService.registerFromBill（核销 → 待结算登记）', () => {
    const ctx = { channelId: 7 };
    let settleRepo;
    let service;
    function makeService() {
        const connection = { getRepository: vitest_1.vi.fn(() => settleRepo) };
        service = new coupon_settlement_service_1.CouponSettlementService(connection);
    }
    function bill(over = {}) {
        return Object.assign({ id: 66, channelId: 7, customerCouponId: 12345, couponTemplateId: 9, discountAmount: 4000 }, over);
    }
    (0, vitest_1.beforeEach)(() => {
        settleRepo = { save: vitest_1.vi.fn(async (r) => r) };
        makeService();
    });
    (0, vitest_1.it)('登记 PENDING：面额=核销优惠额，单号=CSTL-{ch}-{couponId}，凭证=BILL:{billId}', async () => {
        delete process.env.COUPON_SPLIT_COMMISSION_BP;
        await service.registerFromBill(ctx, bill(), 88);
        (0, vitest_1.expect)(settleRepo.save).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            channelId: 7,
            saleOrderId: 88,
            customerCouponId: 12345,
            redeemRef: 'BILL:66',
            inStoreBillId: 66,
            faceAmount: 4000,
            commissionRateBp: 0,
            commissionAmount: 0,
            netAmount: 4000,
            status: 'PENDING',
            settlementNo: 'CSTL-7-12345',
        }));
    });
    (0, vitest_1.it)('唯一约束冲突（重复登记/幂等重放）→ 静默不抛', async () => {
        settleRepo.save.mockRejectedValueOnce(new Error('UNIQUE constraint failed: coupon_settlement_order.customerCouponId'));
        await (0, vitest_1.expect)(service.registerFromBill(ctx, bill(), 88)).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('其它登记异常 → 不抛（不阻断核销主流程，T+1 job 兜底补登）', async () => {
        settleRepo.save.mockRejectedValueOnce(new Error('db gone'));
        await (0, vitest_1.expect)(service.registerFromBill(ctx, bill(), 88)).resolves.toBeUndefined();
    });
});
/**
 * 退款联动（T8）：refundSaleOrder commit 后调 onSaleOrderRefunded——
 * - PENDING → CANCELLED（带原状态条件原子更新）
 * - SETTLED/PAID_OUT → adapter.refundSplit 追偿 → REVERSED（带原状态集合条件）
 * - 任何失败不抛错（不阻断退款主流程）
 */
(0, vitest_1.describe)('CouponSettlementService.onSaleOrderRefunded（退款联动）', () => {
    const ctx = { channelId: 7 };
    let qb;
    let settleRepo;
    let service;
    function makeService() {
        qb = {
            update: vitest_1.vi.fn().mockReturnThis(),
            set: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            execute: vitest_1.vi.fn(async () => ({ affected: 1 })),
        };
        settleRepo = { createQueryBuilder: vitest_1.vi.fn(() => qb), find: vitest_1.vi.fn(async () => []) };
        const connection = {
            rawConnection: { getRepository: vitest_1.vi.fn(() => settleRepo) },
            getRepository: vitest_1.vi.fn(() => settleRepo),
        };
        service = new coupon_settlement_service_1.CouponSettlementService(connection);
    }
    async function mockAdapter(refund) {
        const adapterModule = await import('./coupon-settlement-adapter.js');
        return vitest_1.vi.spyOn(adapterModule, 'resolveSettlementAdapter').mockReturnValue({
            mode: 'stub',
            submitSplit: vitest_1.vi.fn(async () => ({ accepted: true })),
            queryReceipt: vitest_1.vi.fn(async () => ({ state: 'FINISHED' })),
            refundSplit: vitest_1.vi.fn(async () => refund),
        });
    }
    (0, vitest_1.beforeEach)(makeService);
    (0, vitest_1.it)('无结算单 → 空跑 0/0/0 不抛错', async () => {
        settleRepo.find.mockResolvedValueOnce([]);
        await (0, vitest_1.expect)(service.onSaleOrderRefunded(ctx, 88, 'test')).resolves.toEqual({ cancelled: 0, reversed: 0, failed: 0 });
    });
    (0, vitest_1.it)('PENDING → CANCELLED（原子更新带原状态条件 + 备注原因）', async () => {
        settleRepo.find.mockResolvedValueOnce([{ id: 1, status: 'PENDING', settlementNo: 'CSTL-7-1' }]);
        const r = await service.onSaleOrderRefunded(ctx, 88, 'sale refunded');
        (0, vitest_1.expect)(r.cancelled).toBe(1);
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'CANCELLED', remark: 'sale refunded' }));
        (0, vitest_1.expect)(qb.where).toHaveBeenCalledWith('id = :id AND status = :status', { id: 1, status: 'PENDING' });
    });
    (0, vitest_1.it)('PAID_OUT → 追偿受理 → REVERSED（带原状态集合条件 + 追偿回执备注）', async () => {
        settleRepo.find.mockResolvedValueOnce([{ id: 2, status: 'PAID_OUT', settlementNo: 'CSTL-7-2' }]);
        const spy = await mockAdapter({ accepted: true, receiptNo: 'STUB-REV-CSTL-7-2' });
        const r = await service.onSaleOrderRefunded(ctx, 88);
        (0, vitest_1.expect)(r.reversed).toBe(1);
        (0, vitest_1.expect)(qb.set).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ status: 'REVERSED', reversedAt: vitest_1.expect.any(Date), remark: vitest_1.expect.stringContaining('STUB-REV-CSTL-7-2') }));
        (0, vitest_1.expect)(qb.where).toHaveBeenCalledWith('id = :id AND status IN (:...st)', { id: 2, st: ['SETTLED', 'PAID_OUT'] });
        spy.mockRestore();
    });
    (0, vitest_1.it)('追偿被拒 → failed 计数不更新状态（留在重试/对账兜底）', async () => {
        settleRepo.find.mockResolvedValueOnce([{ id: 3, status: 'SETTLED', settlementNo: 'CSTL-7-3' }]);
        const spy = await mockAdapter({ accepted: false, error: 'gateway rejected' });
        const r = await service.onSaleOrderRefunded(ctx, 88);
        (0, vitest_1.expect)(r.reversed).toBe(0);
        (0, vitest_1.expect)(r.failed).toBe(1);
        (0, vitest_1.expect)(qb.execute).not.toHaveBeenCalled();
        spy.mockRestore();
    });
    (0, vitest_1.it)('原子更新未命中（并发已变状态）→ 不计 cancelled（不误报，对账兜底）', async () => {
        settleRepo.find.mockResolvedValueOnce([{ id: 4, status: 'PENDING', settlementNo: 'CSTL-7-4' }]);
        qb.execute.mockResolvedValueOnce({ affected: 0 });
        const r = await service.onSaleOrderRefunded(ctx, 88);
        (0, vitest_1.expect)(r.cancelled).toBe(0);
        (0, vitest_1.expect)(r.reversed).toBe(0);
    });
    (0, vitest_1.it)('查询异常 → 不抛错全量 failed（退款主流程不被阻断）', async () => {
        settleRepo.find.mockRejectedValueOnce(new Error('db gone'));
        await (0, vitest_1.expect)(service.onSaleOrderRefunded(ctx, 88)).resolves.toEqual({ cancelled: 0, reversed: 0, failed: 0 });
    });
});
//# sourceMappingURL=coupon-settlement.service.spec.js.map