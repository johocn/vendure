"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const core_1 = require("@vendure/core");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const coupon_template_entity_1 = require("./coupon-template.entity");
const coupon_expire_reminder_service_1 = require("./coupon-expire-reminder.service");
/**
 * CouponExpireReminderService 单元测试（FR-A2）：
 * - expireStage 纯函数边界（0 / 1 天 / 3 天 / 4 天）；
 * - remindChannel 窗口扫描 + 事件发布（mock TransactionalConnection 与 EventBus），不落库。
 */
(0, vitest_1.describe)('expireStage', () => {
    const now = new Date('2026-10-19T00:00:00Z');
    (0, vitest_1.it)('已过期（t<=0）→ null', () => {
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date('2026-10-18T23:59:59Z'), now)).toBeNull();
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(now, now)).toBeNull();
    });
    (0, vitest_1.it)('<= 1 天 → 1d', () => {
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 1000), now)).toBe('1d');
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 24 * 3600 * 1000), now)).toBe('1d');
    });
    (0, vitest_1.it)('1 天 < t <= 3 天 → 3d', () => {
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 25 * 3600 * 1000), now)).toBe('3d');
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 3 * 24 * 3600 * 1000), now)).toBe('3d');
    });
    (0, vitest_1.it)('> 3 天 → null', () => {
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 3 * 24 * 3600 * 1000 + 1), now)).toBeNull();
        (0, vitest_1.expect)((0, coupon_expire_reminder_service_1.expireStage)(new Date(now.getTime() + 30 * 24 * 3600 * 1000), now)).toBeNull();
    });
});
(0, vitest_1.describe)('CouponExpireReminderService.remindChannel', () => {
    let rawRows;
    let eventBus;
    let service;
    const ctx = { channel: { id: 7 }, channelId: 7, languageCode: 'zh_Hans' };
    /** mock QB 链：innerJoin/where/andWhere/select 可链式，getRawMany 返回 rawRows */
    function mockQb() {
        const qb = {};
        for (const m of ['innerJoin', 'where', 'andWhere', 'select']) {
            qb[m] = vitest_1.vi.fn().mockReturnValue(qb);
        }
        qb.getRawMany = vitest_1.vi.fn().mockResolvedValue(rawRows);
        const repo = { createQueryBuilder: vitest_1.vi.fn().mockReturnValue(qb) };
        const connection = { getRepository: vitest_1.vi.fn().mockReturnValue(repo), rawConnection: { getRepository: vitest_1.vi.fn() } };
        return { qb, connection };
    }
    (0, vitest_1.beforeEach)(() => {
        rawRows = [];
        eventBus = { publish: vitest_1.vi.fn() };
        const { connection } = mockQb();
        service = new coupon_expire_reminder_service_1.CouponExpireReminderService(connection, eventBus);
    });
    (0, vitest_1.it)('窗口内临期券逐条发布事件，stage 按剩余时间判定', async () => {
        const now = new Date();
        rawRows = [
            { id: 1, customerId: 11, code: 'C-AAAA-BBBB', expiredAt: new Date(now.getTime() + 12 * 3600 * 1000), templateId: 83, name: '餐饮买单券' },
            { id: 2, customerId: 12, code: 'C-CCCC-DDDD', expiredAt: new Date(now.getTime() + 2 * 24 * 3600 * 1000), templateId: 84, name: '8折券' },
        ];
        const { connection } = mockQb();
        service = new coupon_expire_reminder_service_1.CouponExpireReminderService(connection, eventBus);
        const r = await service.remindChannel(ctx);
        (0, vitest_1.expect)(r.scanned).toBe(2); // 单次 3 天窗口扫描，stage 按剩余时间逐行判定
        (0, vitest_1.expect)(r.published).toBe(2);
        const payloads = eventBus.publish.mock.calls.map((c) => c[0].payload);
        (0, vitest_1.expect)(payloads.map((p) => p.stage).sort()).toEqual(['1d', '3d']);
        (0, vitest_1.expect)(payloads[0].couponCode).toBe('C-AAAA-BBBB');
        (0, vitest_1.expect)(payloads[0].templateName).toBe('餐饮买单券');
        (0, vitest_1.expect)(payloads[0].customerId).toBe(11);
    });
    (0, vitest_1.it)('空窗口不发布任何事件', async () => {
        const { connection } = mockQb();
        service = new coupon_expire_reminder_service_1.CouponExpireReminderService(connection, eventBus);
        const r = await service.remindChannel(ctx);
        (0, vitest_1.expect)(r.scanned).toBe(0);
        (0, vitest_1.expect)(r.published).toBe(0);
        (0, vitest_1.expect)(eventBus.publish).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('扫描条件下推：status 仅 UNUSED/RETURNED 且 expiredAt 落窗（where 参数校验）', async () => {
        const { qb, connection } = mockQb();
        service = new coupon_expire_reminder_service_1.CouponExpireReminderService(connection, eventBus);
        await service.remindChannel(ctx);
        const whereCall = qb.where.mock.calls[0];
        (0, vitest_1.expect)(whereCall[0]).toContain('status IN');
        (0, vitest_1.expect)(whereCall[1].statuses).toEqual(['UNUSED', 'RETURNED']);
        const andWheres = qb.andWhere.mock.calls.map((c) => c[0]);
        (0, vitest_1.expect)(andWheres.some((s) => s.includes('expiredAt IS NOT NULL'))).toBe(true);
        (0, vitest_1.expect)(andWheres.some((s) => s.includes('expiredAt > :now'))).toBe(true);
        (0, vitest_1.expect)(andWheres.some((s) => s.includes('expiredAt <= :horizon'))).toBe(true);
        // 渠道隔离：模板 channels 命中 ctx.channelId
        const joinCalls = qb.innerJoin.mock.calls.map((c) => c[0]);
        (0, vitest_1.expect)(joinCalls).toContain('tpl.channels');
    });
});
// 引用实体类型防 tree-shaking 误报未使用（与 coupon.service.spec 同风格）
void customer_coupon_entity_1.CustomerCoupon;
void coupon_template_entity_1.CouponTemplate;
void core_1.RequestContext;
//# sourceMappingURL=coupon-expire-reminder.service.spec.js.map