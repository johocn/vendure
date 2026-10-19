"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_fission_1 = require("./coupon-fission");
(0, vitest_1.describe)('分享裂变纯函数（FR-C）', () => {
    const tpl = (id) => ({ id, name: `tpl-${id}` });
    (0, vitest_1.it)('parseCouponFissionConfig：坏 JSON / 非对象 / 空值 → null；字段规整', () => {
        (0, vitest_1.expect)((0, coupon_fission_1.parseCouponFissionConfig)(null)).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.parseCouponFissionConfig)('')).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.parseCouponFissionConfig)('not-json')).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.parseCouponFissionConfig)('[1]')).toBeNull();
        const cfg = (0, coupon_fission_1.parseCouponFissionConfig)('{"enabled":true,"name":"邀好友","endsAt":"2026-10-26T20:00:00+08:00","inviteeTemplateId":"83","inviterRewardLimit":"3"}');
        (0, vitest_1.expect)(cfg).toEqual({
            enabled: true,
            name: '邀好友',
            subtitle: null,
            rules: null,
            startsAt: null,
            endsAt: '2026-10-26T12:00:00.000Z',
            inviteeTemplateId: 83,
            inviterTemplateId: 0,
            inviterRewardLimit: 3,
            newCustomerOnly: false,
        });
    });
    (0, vitest_1.it)('resolveActiveFission：窗口判定 + 被分享者奖励必填 + 命中过滤', () => {
        var _a;
        const raw = {
            enabled: true,
            name: '邀好友得券',
            endsAt: '2026-10-26T12:00:00Z',
            inviteeTemplateId: 83,
            inviterTemplateId: 84,
        };
        const view = (0, coupon_fission_1.resolveActiveFission)(raw, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        (0, vitest_1.expect)(view === null || view === void 0 ? void 0 : view.inviteeTemplate.id).toBe(83);
        (0, vitest_1.expect)((_a = view === null || view === void 0 ? void 0 : view.inviterTemplate) === null || _a === void 0 ? void 0 : _a.id).toBe(84);
        // 未开始
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(Object.assign(Object.assign({}, raw), { startsAt: '2026-12-01T00:00:00Z' }), [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 已结束 / 缺 endsAt（视为未配置完整）
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(raw, [tpl(83), tpl(84)], new Date('2026-10-27T00:00:00Z'), 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(Object.assign(Object.assign({}, raw), { endsAt: null }), [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 缺被分享者奖励模板
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(Object.assign(Object.assign({}, raw), { inviteeTemplateId: 0 }), [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 奖励模板不在本店目录
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(raw, [tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // disabled / 无文案
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(Object.assign(Object.assign({}, raw), { enabled: false }), [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.resolveActiveFission)(Object.assign(Object.assign({}, raw), { name: '' }), [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
    });
    (0, vitest_1.it)('resolveActiveFission：inviterTemplate 不在目录 → 仅被分享者奖励', () => {
        const raw = { enabled: true, name: 'x', endsAt: '2026-10-26T12:00:00Z', inviteeTemplateId: 83, inviterTemplateId: 999 };
        const view = (0, coupon_fission_1.resolveActiveFission)(raw, [tpl(83)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        (0, vitest_1.expect)(view === null || view === void 0 ? void 0 : view.inviteeTemplate.id).toBe(83);
        (0, vitest_1.expect)(view === null || view === void 0 ? void 0 : view.inviterTemplate).toBeNull();
    });
    (0, vitest_1.it)('localizeFissionText：精确 lang → 去地区码 → 首个非空', () => {
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)('直接文案', 'zh_Hans')).toBe('直接文案');
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)({ zh_Hans: '中', en: 'en' }, 'zh_Hans')).toBe('中');
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)({ zh: '中简', en: 'en' }, 'zh_Hans')).toBe('中简');
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)({ en: 'en' }, 'zh_Hans')).toBe('en');
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)({ en: '' }, 'zh_Hans')).toBeNull();
        (0, vitest_1.expect)((0, coupon_fission_1.localizeFissionText)(null, 'zh_Hans')).toBeNull();
    });
});
//# sourceMappingURL=coupon-fission.spec.js.map