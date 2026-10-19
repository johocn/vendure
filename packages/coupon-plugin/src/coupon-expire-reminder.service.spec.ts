import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '@vendure/core';

import { CustomerCoupon } from './customer-coupon.entity';
import { CouponTemplate } from './coupon-template.entity';
import { CouponExpireRemindEvent } from './coupon-expire-reminder.events';
import { CouponExpireReminderService, expireStage } from './coupon-expire-reminder.service';

/**
 * CouponExpireReminderService 单元测试（FR-A2）：
 * - expireStage 纯函数边界（0 / 1 天 / 3 天 / 4 天）；
 * - remindChannel 窗口扫描 + 事件发布（mock TransactionalConnection 与 EventBus），不落库。
 */
describe('expireStage', () => {
    const now = new Date('2026-10-19T00:00:00Z');

    it('已过期（t<=0）→ null', () => {
        expect(expireStage(new Date('2026-10-18T23:59:59Z'), now)).toBeNull();
        expect(expireStage(now, now)).toBeNull();
    });

    it('<= 1 天 → 1d', () => {
        expect(expireStage(new Date(now.getTime() + 1000), now)).toBe('1d');
        expect(expireStage(new Date(now.getTime() + 24 * 3600 * 1000), now)).toBe('1d');
    });

    it('1 天 < t <= 3 天 → 3d', () => {
        expect(expireStage(new Date(now.getTime() + 25 * 3600 * 1000), now)).toBe('3d');
        expect(expireStage(new Date(now.getTime() + 3 * 24 * 3600 * 1000), now)).toBe('3d');
    });

    it('> 3 天 → null', () => {
        expect(expireStage(new Date(now.getTime() + 3 * 24 * 3600 * 1000 + 1), now)).toBeNull();
        expect(expireStage(new Date(now.getTime() + 30 * 24 * 3600 * 1000), now)).toBeNull();
    });
});

describe('CouponExpireReminderService.remindChannel', () => {
    let rawRows: any[];
    let eventBus: { publish: ReturnType<typeof vi.fn> };
    let service: CouponExpireReminderService;
    const ctx: any = { channel: { id: 7 }, channelId: 7, languageCode: 'zh_Hans' };

    /** mock QB 链：innerJoin/where/andWhere/select 可链式，getRawMany 返回 rawRows */
    function mockQb() {
        const qb: any = {};
        for (const m of ['innerJoin', 'where', 'andWhere', 'select']) {
            qb[m] = vi.fn().mockReturnValue(qb);
        }
        qb.getRawMany = vi.fn().mockResolvedValue(rawRows);
        const repo = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
        const connection: any = { getRepository: vi.fn().mockReturnValue(repo), rawConnection: { getRepository: vi.fn() } };
        return { qb, connection };
    }

    beforeEach(() => {
        rawRows = [];
        eventBus = { publish: vi.fn() };
        const { connection } = mockQb();
        service = new CouponExpireReminderService(connection, eventBus as any);
    });

    it('窗口内临期券逐条发布事件，stage 按剩余时间判定', async () => {
        const now = new Date();
        rawRows = [
            { id: 1, customerId: 11, code: 'C-AAAA-BBBB', expiredAt: new Date(now.getTime() + 12 * 3600 * 1000), templateId: 83, name: '餐饮买单券' },
            { id: 2, customerId: 12, code: 'C-CCCC-DDDD', expiredAt: new Date(now.getTime() + 2 * 24 * 3600 * 1000), templateId: 84, name: '8折券' },
        ];
        const { connection } = mockQb();
        service = new CouponExpireReminderService(connection, eventBus as any);

        const r = await service.remindChannel(ctx);

        expect(r.scanned).toBe(2); // 单次 3 天窗口扫描，stage 按剩余时间逐行判定
        expect(r.published).toBe(2);
        const payloads = eventBus.publish.mock.calls.map((c: any[]) => (c[0] as CouponExpireRemindEvent).payload);
        expect(payloads.map((p) => p.stage).sort()).toEqual(['1d', '3d']);
        expect(payloads[0].couponCode).toBe('C-AAAA-BBBB');
        expect(payloads[0].templateName).toBe('餐饮买单券');
        expect(payloads[0].customerId).toBe(11);
    });

    it('空窗口不发布任何事件', async () => {
        const { connection } = mockQb();
        service = new CouponExpireReminderService(connection, eventBus as any);
        const r = await service.remindChannel(ctx);
        expect(r.scanned).toBe(0);
        expect(r.published).toBe(0);
        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('扫描条件下推：status 仅 UNUSED/RETURNED 且 expiredAt 落窗（where 参数校验）', async () => {
        const { qb, connection } = mockQb();
        service = new CouponExpireReminderService(connection, eventBus as any);
        await service.remindChannel(ctx);
        const whereCall = (qb.where as any).mock.calls[0];
        expect(whereCall[0]).toContain('status IN');
        expect(whereCall[1].statuses).toEqual(['UNUSED', 'RETURNED']);
        const andWheres = (qb.andWhere as any).mock.calls.map((c: any[]) => c[0]);
        expect(andWheres.some((s: string) => s.includes('expiredAt IS NOT NULL'))).toBe(true);
        expect(andWheres.some((s: string) => s.includes('expiredAt > :now'))).toBe(true);
        expect(andWheres.some((s: string) => s.includes('expiredAt <= :horizon'))).toBe(true);
        // 渠道隔离：模板 channels 命中 ctx.channelId
        const joinCalls = (qb.innerJoin as any).mock.calls.map((c: any[]) => c[0]);
        expect(joinCalls).toContain('tpl.channels');
    });
});

// 引用实体类型防 tree-shaking 误报未使用（与 coupon.service.spec 同风格）
void CustomerCoupon;
void CouponTemplate;
void RequestContext;
