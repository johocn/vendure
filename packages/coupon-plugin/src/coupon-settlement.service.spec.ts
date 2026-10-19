import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 使模块命名空间可 spy（覆盖 resolveSettlementAdapter 注入故障适配器）
vi.mock('./coupon-settlement-adapter', async importOriginal => {
    const actual = await importOriginal<typeof import('./coupon-settlement-adapter')>();
    return { ...actual };
});

import {
    buildSettlementNo,
    computeSettlementAmounts,
    resolveSettlementAdapter,
} from './coupon-settlement-adapter';
import { CouponSettlementOrder } from './coupon-settlement-order.entity';
import { CouponSettlementService } from './coupon-settlement.service';
import { InStoreBill } from './in-store-bill.entity';

describe('computeSettlementAmounts 佣金/净付额', () => {
    it('5% 佣金：面额 ¥100 → 佣金 ¥5 / 净付 ¥95', () => {
        expect(computeSettlementAmounts(10000, 500)).toEqual({ commissionAmount: 500, netAmount: 9500 });
    });

    it('零头向下取整：面额 33 分 × 3.33%（333bp）→ 佣金 1 分', () => {
        expect(computeSettlementAmounts(33, 333)).toEqual({ commissionAmount: 1, netAmount: 32 });
    });

    it('费率 0 = 平台暂不分佣（P0 默认）', () => {
        expect(computeSettlementAmounts(10000, 0)).toEqual({ commissionAmount: 0, netAmount: 10000 });
    });

    it('负数/非数输入按 0 兜底', () => {
        expect(computeSettlementAmounts(-5, 500).netAmount).toBe(0);
        expect(computeSettlementAmounts(Number.NaN, 500).netAmount).toBe(0);
    });
});

describe('结算单号（分账幂等键）', () => {
    it('确定性生成：CSTL-{channelId}-{customerCouponId}', () => {
        expect(buildSettlementNo(7, 12345)).toBe('CSTL-7-12345');
    });
});

describe('resolveSettlementAdapter 模式开关（风险铁律①）', () => {
    const originalMode = process.env.COUPON_SPLIT_MODE;

    afterEach(() => {
        if (originalMode === undefined) delete process.env.COUPON_SPLIT_MODE;
        else process.env.COUPON_SPLIT_MODE = originalMode;
    });

    it('默认/stub → stub 适配器，回执号带幂等键', async () => {
        delete process.env.COUPON_SPLIT_MODE;
        const adapter = resolveSettlementAdapter();
        expect(adapter.mode).toBe('stub');
        const res = await adapter.submitSplit({ settlementNo: 'CSTL-7-1' } as any, 'CSTL-7-1');
        expect(res.accepted).toBe(true);
        expect(res.receiptNo).toBe('STUB-CSTL-7-1');
        expect((await adapter.queryReceipt('any')).state).toBe('FINISHED');
    });

    it('wechat 实联未持合规结论 → 明确拒绝（不静默回落 stub）', () => {
        process.env.COUPON_SPLIT_MODE = 'wechat';
        expect(() => resolveSettlementAdapter()).toThrow(/compliance approval/);
    });

    it('未知模式 → 回落 stub', () => {
        process.env.COUPON_SPLIT_MODE = 'mystery';
        expect(resolveSettlementAdapter().mode).toBe('stub');
    });
});

/**
 * runSettlementCycle（T+1 汇总 job）核心不变量（风险铁律②④）：
 * - 提交查询 SQL 下推：status=PENDING + attempts 上限 + createdAt T+1 界线（Date 参数绑定）
 * - 状态推进全部带原状态条件原子更新
 * - backfill 查询排除已登记（LEFT JOIN s.id IS NULL）且日期用 Date 绑定
 */
describe('CouponSettlementService.runSettlementCycle', () => {
    const ctx: any = { channelId: 7 };
    let selectQb: any;
    let updateQb: any;
    let settleRepo: any;
    let billRepo: any;
    let service: CouponSettlementService;

    beforeEach(() => {
        selectQb = {
            select: vi.fn().mockReturnThis(),
            addSelect: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            take: vi.fn().mockReturnThis(),
            getRawMany: vi.fn(async () => []),
            getMany: vi.fn(async () => []),
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            execute: vi.fn(async () => ({ affected: 1 })),
        };
        updateQb = selectQb;
        settleRepo = {
            createQueryBuilder: vi.fn(() => selectQb),
            find: vi.fn(async () => []),
            save: vi.fn(async (r: any) => r),
        };
        billRepo = { createQueryBuilder: vi.fn(() => selectQb) };
        const connection: any = {
            rawConnection: {
                getRepository: vi.fn((entity: any) => {
                    if (entity === InStoreBill) return billRepo;
                    return settleRepo;
                }),
            },
            getRepository: vi.fn(() => settleRepo),
        };
        service = new CouponSettlementService(connection);
        vi.spyOn(service as any, 'settlementCutoff').mockReturnValue(new Date('2026-10-19T00:00:00'));
    });

    it('提交查询 SQL 下推：PENDING + attempts 上限 + T+1 界线（Date 绑定，非字符串比较）', async () => {
        await service.runSettlementCycle();
        // 提交查询：where('s.status = :status'...) + andWhere attempts + andWhere createdAt
        expect(selectQb.where).toHaveBeenCalledWith('s.status = :status', { status: 'PENDING' });
        expect(selectQb.andWhere).toHaveBeenCalledWith('s.attempts < :max', expect.objectContaining({ max: expect.any(Number) }));
        const cutoffCall = selectQb.andWhere.mock.calls.find(
            (c: any[]) => typeof c[0] === 'string' && c[0].includes('s.createdAt'),
        );
        expect(cutoffCall).toBeTruthy();
        expect(cutoffCall![1].cutoff).toBeInstanceOf(Date);
        expect((cutoffCall![1].cutoff as Date).toISOString()).toBe('2026-10-18T16:00:00.000Z'); // 东八区零点
    });

    it('提交成功 → 带原状态条件原子更新为 SETTLED（含回执号与模式快照）', async () => {
        const row = { id: 1, status: 'PENDING', attempts: 0, settlementNo: 'CSTL-7-1' } as any;
        selectQb.getMany.mockResolvedValueOnce([row]);
        await service.runSettlementCycle();
        // 抢占更新：attempts + 1（带 status=PENDING 条件）
        expect(selectQb.update).toHaveBeenCalledWith(CouponSettlementOrder);
        expect(selectQb.where).toHaveBeenCalledWith('id = :id AND status = :status', { id: 1, status: 'PENDING' });
        // 置 SETTLED：同样带 PENDING 条件
        expect(selectQb.set).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'SETTLED', splitMode: 'stub', splitReceiptNo: 'STUB-CSTL-7-1' }),
        );
    });

    it('提交抛错 → 留在 PENDING 记录 lastError（进重试队列）', async () => {
        const row = { id: 2, status: 'PENDING', attempts: 0, settlementNo: 'CSTL-7-2' } as any;
        selectQb.getMany.mockResolvedValueOnce([row]);
        const adapterModule = await import('./coupon-settlement-adapter.js');
        const spy = vi.spyOn(adapterModule, 'resolveSettlementAdapter').mockReturnValue({
            mode: 'stub',
            submitSplit: vi.fn(async () => {
                throw new Error('gateway down');
            }),
            queryReceipt: vi.fn(async () => ({ state: 'PROCESSING' as const })),
            refundSplit: vi.fn(async () => ({ accepted: true })),
        } as any);
        const r = await service.runSettlementCycle();
        expect(r.submitted).toBe(0);
        const errCall = selectQb.set.mock.calls.find((c: any[]) => 'lastError' in (c[0] ?? {}));
        expect(errCall).toBeTruthy();
        expect(errCall![0].lastError).toContain('gateway down');
        spy.mockRestore();
    });

    it('回执 FINISHED → 带原状态条件推进 PAID_OUT', async () => {
        settleRepo.find.mockResolvedValueOnce([
            { id: 3, status: 'SETTLED', settlementNo: 'CSTL-7-3', splitReceiptNo: 'STUB-CSTL-7-3' } as any,
        ]);
        const r = await service.runSettlementCycle();
        expect(r.promoted).toBe(1);
        expect(selectQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID_OUT' }));
        expect(selectQb.where).toHaveBeenCalledWith('id = :id AND status = :status', { id: 3, status: 'SETTLED' });
    });
});

describe('CouponSettlementService.registerFromBill（核销 → 待结算登记）', () => {
    const ctx: any = { channelId: 7 };
    let settleRepo: any;
    let service: CouponSettlementService;

    function makeService() {
        const connection: any = { getRepository: vi.fn(() => settleRepo) };
        service = new CouponSettlementService(connection);
    }

    function bill(over: Record<string, any> = {}): any {
        return {
            id: 66,
            channelId: 7,
            customerCouponId: 12345,
            couponTemplateId: 9,
            discountAmount: 4000,
            ...over,
        };
    }

    beforeEach(() => {
        settleRepo = { save: vi.fn(async (r: any) => r) };
        makeService();
    });

    it('登记 PENDING：面额=核销优惠额，单号=CSTL-{ch}-{couponId}，凭证=BILL:{billId}', async () => {
        delete process.env.COUPON_SPLIT_COMMISSION_BP;
        await service.registerFromBill(ctx, bill(), 88);
        expect(settleRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({
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
            }),
        );
    });

    it('唯一约束冲突（重复登记/幂等重放）→ 静默不抛', async () => {
        settleRepo.save.mockRejectedValueOnce(new Error('UNIQUE constraint failed: coupon_settlement_order.customerCouponId'));
        await expect(service.registerFromBill(ctx, bill(), 88)).resolves.toBeUndefined();
    });

    it('其它登记异常 → 不抛（不阻断核销主流程，T+1 job 兜底补登）', async () => {
        settleRepo.save.mockRejectedValueOnce(new Error('db gone'));
        await expect(service.registerFromBill(ctx, bill(), 88)).resolves.toBeUndefined();
    });
});
