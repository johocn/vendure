"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_frf_1 = require("./coupon-frf");
const NOW = new Date('2026-10-20T04:00:00Z'); // UTC+8 = 12:00 当天
const lang = 'zh_Hans';
const tpl = (id) => ({ id, enabled: true });
(0, vitest_1.describe)('windowState', () => {
    (0, vitest_1.it)('null 窗口 = ACTIVE（不限端）', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.windowState)(null, null, NOW)).toBe('ACTIVE');
    });
    (0, vitest_1.it)('未开始 / 进行中 / 已结束', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.windowState)('2026-10-21T00:00:00Z', '2026-10-22T00:00:00Z', NOW)).toBe('PENDING');
        (0, vitest_1.expect)((0, coupon_frf_1.windowState)('2026-10-19T00:00:00Z', '2026-10-21T00:00:00Z', NOW)).toBe('ACTIVE');
        (0, vitest_1.expect)((0, coupon_frf_1.windowState)('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', NOW)).toBe('ENDED');
    });
});
(0, vitest_1.describe)('claimDateUtc8', () => {
    (0, vitest_1.it)('UTC+8 日界：23:59 与次日 00:01 属不同业务日（A4）', () => {
        const before = new Date('2026-10-20T15:59:00Z'); // UTC+8 23:59
        const after = new Date('2026-10-20T16:01:00Z'); // UTC+8 次日 00:01
        (0, vitest_1.expect)((0, coupon_frf_1.claimDateUtc8)(before)).toBe('2026-10-20');
        (0, vitest_1.expect)((0, coupon_frf_1.claimDateUtc8)(after)).toBe('2026-10-21');
    });
});
(0, vitest_1.describe)('parseCouponDailyClaimConfig', () => {
    (0, vitest_1.it)('坏 JSON / 空模板 / 非对象返回 null（R6）', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponDailyClaimConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponDailyClaimConfig)('')).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponDailyClaimConfig)('not-json{')).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponDailyClaimConfig)('[]')).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponDailyClaimConfig)('{"templateIds":[]}')).toBeNull();
    });
    (0, vitest_1.it)('合法配置规整；enabled 缺省 true', () => {
        const cfg = (0, coupon_frf_1.parseCouponDailyClaimConfig)('{"name":"每日领券","templateIds":[1,2],"startsAt":"","endsAt":null}');
        (0, vitest_1.expect)(cfg).not.toBeNull();
        (0, vitest_1.expect)(cfg.enabled).toBe(true);
        (0, vitest_1.expect)(cfg.templateIds).toEqual([1, 2]);
        (0, vitest_1.expect)(cfg.startsAt).toBeNull();
    });
});
(0, vitest_1.describe)('resolveActiveDailyClaim', () => {
    const raw = JSON.stringify({
        name: { zh: '每日领券', en: 'Daily Coupons' },
        subtitle: '每天可领',
        templateIds: [1, 2],
    });
    (0, vitest_1.it)('命中本店模板并本地化', () => {
        const view = (0, coupon_frf_1.resolveActiveDailyClaim)(raw, [tpl(1), tpl(2), tpl(3)], NOW, lang);
        (0, vitest_1.expect)(view).not.toBeNull();
        (0, vitest_1.expect)(view.name).toBe('每日领券');
        (0, vitest_1.expect)(view.templates.map(t => t.id)).toEqual([1, 2]);
    });
    (0, vitest_1.it)('模板全不命中 / 禁用 / 名称缺失 → null', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveDailyClaim)(raw, [tpl(3)], NOW, lang)).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveDailyClaim)('{"enabled":false,"name":"x","templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveDailyClaim)('{"templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
    });
    (0, vitest_1.it)('时间窗外不可见（A5）', () => {
        const win = JSON.stringify({ name: 'n', templateIds: [1], startsAt: '2026-10-21T00:00:00Z' });
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveDailyClaim)(win, [tpl(1)], NOW, lang)).toBeNull();
    });
});
(0, vitest_1.describe)('parseCouponFlashSaleConfig', () => {
    (0, vitest_1.it)('perUserLimit 缺省 1、非法抬到 1、0 视为 1', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponFlashSaleConfig)('{"templateIds":[1]}').perUserLimit).toBe(1);
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponFlashSaleConfig)('{"templateIds":[1],"perUserLimit":0}').perUserLimit).toBe(1);
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponFlashSaleConfig)('{"templateIds":[1],"perUserLimit":3}').perUserLimit).toBe(3);
    });
    (0, vitest_1.it)('无模板返回 null（R6）', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponFlashSaleConfig)('{"name":"n"}')).toBeNull();
    });
});
(0, vitest_1.describe)('resolveActiveFlashSale', () => {
    (0, vitest_1.it)('窗口必须完整：缺 startsAt/endsAt 返回 null', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveFlashSale)('{"name":"n","templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.resolveActiveFlashSale)(JSON.stringify({ name: 'n', templateIds: [1], startsAt: '2026-10-19T00:00:00Z' }), [tpl(1)], NOW, lang)).toBeNull();
    });
    (0, vitest_1.it)('窗内且命中 → 视图含 perUserLimit', () => {
        const raw = JSON.stringify({
            name: '神券日',
            templateIds: [1],
            startsAt: '2026-10-19T00:00:00Z',
            endsAt: '2026-10-21T00:00:00Z',
            perUserLimit: 2,
        });
        const view = (0, coupon_frf_1.resolveActiveFlashSale)(raw, [tpl(1)], NOW, lang);
        (0, vitest_1.expect)(view).not.toBeNull();
        (0, vitest_1.expect)(view.perUserLimit).toBe(2);
        (0, vitest_1.expect)(view.endsAt).toBe('2026-10-21T00:00:00.000Z');
    });
});
(0, vitest_1.describe)('parseCouponPayGiftConfig', () => {
    (0, vitest_1.it)('templateId 缺失/非法 → null', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('{"enabled":true}')).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":0}')).toBeNull();
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('bad{')).toBeNull();
    });
    (0, vitest_1.it)('cooldownDays 强制 ≥1（防重复事件），上限 365；minAmount 非负', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":5,"cooldownDays":0}').cooldownDays).toBe(1);
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":5,"cooldownDays":9999}').cooldownDays).toBe(365);
        (0, vitest_1.expect)((0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":5,"minAmount":-5}').minAmount).toBe(0);
    });
});
(0, vitest_1.describe)('payGiftEligible', () => {
    const cfg = (0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":5,"minAmount":5000}');
    (0, vitest_1.it)('达标/未达标（C2）', () => {
        (0, vitest_1.expect)((0, coupon_frf_1.payGiftEligible)(cfg, 5000)).toBe(true);
        (0, vitest_1.expect)((0, coupon_frf_1.payGiftEligible)(cfg, 4999)).toBe(false);
    });
    (0, vitest_1.it)('minAmount=0 不限', () => {
        const free = (0, coupon_frf_1.parseCouponPayGiftConfig)('{"templateId":5,"minAmount":0}');
        (0, vitest_1.expect)((0, coupon_frf_1.payGiftEligible)(free, 1)).toBe(true);
    });
});
//# sourceMappingURL=coupon-frf.spec.js.map