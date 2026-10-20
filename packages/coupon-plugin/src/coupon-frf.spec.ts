import { describe, expect, it } from 'vitest';

import {
    claimDateUtc8,
    parseCouponDailyClaimConfig,
    parseCouponFlashSaleConfig,
    parseCouponPayGiftConfig,
    payGiftEligible,
    resolveActiveDailyClaim,
    resolveActiveFlashSale,
    windowState,
} from './coupon-frf';

interface Tpl {
    id: number;
    enabled?: boolean;
}

const NOW = new Date('2026-10-20T04:00:00Z'); // UTC+8 = 12:00 当天
const lang = 'zh_Hans';

const tpl = (id: number): Tpl => ({ id, enabled: true });

describe('windowState', () => {
    it('null 窗口 = ACTIVE（不限端）', () => {
        expect(windowState(null, null, NOW)).toBe('ACTIVE');
    });
    it('未开始 / 进行中 / 已结束', () => {
        expect(windowState('2026-10-21T00:00:00Z', '2026-10-22T00:00:00Z', NOW)).toBe('PENDING');
        expect(windowState('2026-10-19T00:00:00Z', '2026-10-21T00:00:00Z', NOW)).toBe('ACTIVE');
        expect(windowState('2026-10-19T00:00:00Z', '2026-10-20T00:00:00Z', NOW)).toBe('ENDED');
    });
});

describe('claimDateUtc8', () => {
    it('UTC+8 日界：23:59 与次日 00:01 属不同业务日（A4）', () => {
        const before = new Date('2026-10-20T15:59:00Z'); // UTC+8 23:59
        const after = new Date('2026-10-20T16:01:00Z'); // UTC+8 次日 00:01
        expect(claimDateUtc8(before)).toBe('2026-10-20');
        expect(claimDateUtc8(after)).toBe('2026-10-21');
    });
});

describe('parseCouponDailyClaimConfig', () => {
    it('坏 JSON / 空模板 / 非对象返回 null（R6）', () => {
        expect(parseCouponDailyClaimConfig(null)).toBeNull();
        expect(parseCouponDailyClaimConfig('')).toBeNull();
        expect(parseCouponDailyClaimConfig('not-json{')).toBeNull();
        expect(parseCouponDailyClaimConfig('[]')).toBeNull();
        expect(parseCouponDailyClaimConfig('{"templateIds":[]}')).toBeNull();
    });
    it('合法配置规整；enabled 缺省 true', () => {
        const cfg = parseCouponDailyClaimConfig('{"name":"每日领券","templateIds":[1,2],"startsAt":"","endsAt":null}');
        expect(cfg).not.toBeNull();
        expect(cfg!.enabled).toBe(true);
        expect(cfg!.templateIds).toEqual([1, 2]);
        expect(cfg!.startsAt).toBeNull();
    });
});

describe('resolveActiveDailyClaim', () => {
    const raw = JSON.stringify({
        name: { zh: '每日领券', en: 'Daily Coupons' },
        subtitle: '每天可领',
        templateIds: [1, 2],
    });
    it('命中本店模板并本地化', () => {
        const view = resolveActiveDailyClaim(raw, [tpl(1), tpl(2), tpl(3)], NOW, lang);
        expect(view).not.toBeNull();
        expect(view!.name).toBe('每日领券');
        expect(view!.templates.map(t => t.id)).toEqual([1, 2]);
    });
    it('模板全不命中 / 禁用 / 名称缺失 → null', () => {
        expect(resolveActiveDailyClaim(raw, [tpl(3)], NOW, lang)).toBeNull();
        expect(resolveActiveDailyClaim('{"enabled":false,"name":"x","templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
        expect(resolveActiveDailyClaim('{"templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
    });
    it('时间窗外不可见（A5）', () => {
        const win = JSON.stringify({ name: 'n', templateIds: [1], startsAt: '2026-10-21T00:00:00Z' });
        expect(resolveActiveDailyClaim(win, [tpl(1)], NOW, lang)).toBeNull();
    });
});

describe('parseCouponFlashSaleConfig', () => {
    it('perUserLimit 缺省 1、非法抬到 1、0 视为 1', () => {
        expect(parseCouponFlashSaleConfig('{"templateIds":[1]}')!.perUserLimit).toBe(1);
        expect(parseCouponFlashSaleConfig('{"templateIds":[1],"perUserLimit":0}')!.perUserLimit).toBe(1);
        expect(parseCouponFlashSaleConfig('{"templateIds":[1],"perUserLimit":3}')!.perUserLimit).toBe(3);
    });
    it('无模板返回 null（R6）', () => {
        expect(parseCouponFlashSaleConfig('{"name":"n"}')).toBeNull();
    });
});

describe('resolveActiveFlashSale', () => {
    it('窗口必须完整：缺 startsAt/endsAt 返回 null', () => {
        expect(resolveActiveFlashSale('{"name":"n","templateIds":[1]}', [tpl(1)], NOW, lang)).toBeNull();
        expect(
            resolveActiveFlashSale(
                JSON.stringify({ name: 'n', templateIds: [1], startsAt: '2026-10-19T00:00:00Z' }),
                [tpl(1)],
                NOW,
                lang,
            ),
        ).toBeNull();
    });
    it('窗内且命中 → 视图含 perUserLimit', () => {
        const raw = JSON.stringify({
            name: '神券日',
            templateIds: [1],
            startsAt: '2026-10-19T00:00:00Z',
            endsAt: '2026-10-21T00:00:00Z',
            perUserLimit: 2,
        });
        const view = resolveActiveFlashSale(raw, [tpl(1)], NOW, lang);
        expect(view).not.toBeNull();
        expect(view!.perUserLimit).toBe(2);
        expect(view!.endsAt).toBe('2026-10-21T00:00:00.000Z');
    });
});

describe('parseCouponPayGiftConfig', () => {
    it('templateId 缺失/非法 → null', () => {
        expect(parseCouponPayGiftConfig('{"enabled":true}')).toBeNull();
        expect(parseCouponPayGiftConfig('{"templateId":0}')).toBeNull();
        expect(parseCouponPayGiftConfig('bad{')).toBeNull();
    });
    it('cooldownDays 强制 ≥1（防重复事件），上限 365；minAmount 非负', () => {
        expect(parseCouponPayGiftConfig('{"templateId":5,"cooldownDays":0}')!.cooldownDays).toBe(1);
        expect(parseCouponPayGiftConfig('{"templateId":5,"cooldownDays":9999}')!.cooldownDays).toBe(365);
        expect(parseCouponPayGiftConfig('{"templateId":5,"minAmount":-5}')!.minAmount).toBe(0);
    });
});

describe('payGiftEligible', () => {
    const cfg = parseCouponPayGiftConfig('{"templateId":5,"minAmount":5000}')!;
    it('达标/未达标（C2）', () => {
        expect(payGiftEligible(cfg, 5000)).toBe(true);
        expect(payGiftEligible(cfg, 4999)).toBe(false);
    });
    it('minAmount=0 不限', () => {
        const free = parseCouponPayGiftConfig('{"templateId":5,"minAmount":0}')!;
        expect(payGiftEligible(free, 1)).toBe(true);
    });
});
