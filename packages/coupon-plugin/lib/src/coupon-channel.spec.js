"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coupon_channel_1 = require("./coupon-channel");
const legacy = (over = {}) => (Object.assign({ distributionChannels: null, claimable: false, pointsPrice: 0, claimCode: null, usageScene: 'ONLINE' }, over));
(0, vitest_1.describe)('parseDistributionChannels', () => {
    (0, vitest_1.it)('解析逗号分隔渠道并去重、去空白、忽略未知代号', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.parseDistributionChannels)(' centre , SALE ,centre,BOGUS, POINTS ')).toEqual([
            'CENTRE',
            'SALE',
            'POINTS',
        ]);
    });
    (0, vitest_1.it)('null / undefined / 空串返回空数组', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.parseDistributionChannels)(null)).toEqual([]);
        (0, vitest_1.expect)((0, coupon_channel_1.parseDistributionChannels)(undefined)).toEqual([]);
        (0, vitest_1.expect)((0, coupon_channel_1.parseDistributionChannels)('')).toEqual([]);
    });
});
(0, vitest_1.describe)('resolveCouponChannels', () => {
    (0, vitest_1.it)('显式配置优先，且不再叠加老字段推导', () => {
        const tpl = { distributionChannels: 'SALE', claimable: true, pointsPrice: 300, claimCode: 'X' };
        (0, vitest_1.expect)((0, coupon_channel_1.resolveCouponChannels)(tpl, true)).toEqual(['SALE']);
    });
    (0, vitest_1.it)('历史券（无显式配置）由老字段推导', () => {
        const tpl = { distributionChannels: null, claimable: true, pointsPrice: 300, claimCode: 'NEW2026' };
        (0, vitest_1.expect)((0, coupon_channel_1.resolveCouponChannels)(tpl, true)).toEqual(['CENTRE', 'POINTS', 'CODE', 'PRODUCT']);
    });
    (0, vitest_1.it)('历史券无任何来源时返回空数组（GRANT 无历史推导来源）', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.resolveCouponChannels)(legacy(), false)).toEqual([]);
    });
    (0, vitest_1.it)('空白字符串的显式配置等同未配置，回落老字段', () => {
        const tpl = { distributionChannels: '  ', claimable: true, pointsPrice: 0, claimCode: null };
        (0, vitest_1.expect)((0, coupon_channel_1.resolveCouponChannels)(tpl, false)).toEqual(['CENTRE']);
    });
    (0, vitest_1.it)('全部为未知代号时视为无效配置，回落老字段', () => {
        const tpl = { distributionChannels: 'FOO,BAR', claimable: true, pointsPrice: 0, claimCode: null };
        (0, vitest_1.expect)((0, coupon_channel_1.resolveCouponChannels)(tpl, false)).toEqual(['CENTRE']);
    });
});
(0, vitest_1.describe)('hasChannel', () => {
    (0, vitest_1.it)('显式含 PRODUCT 时即便没有绑券也算命中', () => {
        const tpl = { distributionChannels: 'PRODUCT', claimable: false, pointsPrice: 0, claimCode: null };
        (0, vitest_1.expect)((0, coupon_channel_1.hasChannel)(tpl, false, 'PRODUCT')).toBe(true);
    });
    (0, vitest_1.it)('显式不含 CENTRE 时老字段 claimable 不生效', () => {
        const tpl = { distributionChannels: 'SALE', claimable: true, pointsPrice: 0, claimCode: null };
        (0, vitest_1.expect)((0, coupon_channel_1.hasChannel)(tpl, false, 'CENTRE')).toBe(false);
    });
});
(0, vitest_1.describe)('matchesScene', () => {
    (0, vitest_1.it)('ALL 同时匹配线上与到店', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)('ALL', 'ONLINE')).toBe(true);
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)('ALL', 'IN_STORE')).toBe(true);
    });
    (0, vitest_1.it)('ONLINE 不匹配到店，IN_STORE 不匹配线上', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)('ONLINE', 'IN_STORE')).toBe(false);
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)('IN_STORE', 'ONLINE')).toBe(false);
    });
    (0, vitest_1.it)('null / undefined 按 ONLINE 处理（历史数据语义）', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)(null, 'ONLINE')).toBe(true);
        (0, vitest_1.expect)((0, coupon_channel_1.matchesScene)(undefined, 'IN_STORE')).toBe(false);
    });
});
(0, vitest_1.describe)('filterTemplatesByChannelAndScene', () => {
    const list = [
        legacy({ claimable: true, usageScene: 'ONLINE' }),
        legacy({ pointsPrice: 500, usageScene: 'IN_STORE' }),
        { distributionChannels: 'CENTRE,POINTS', claimable: false, pointsPrice: 0, claimCode: null, usageScene: 'ALL' },
        { distributionChannels: 'SALE', claimable: true, pointsPrice: 900, claimCode: null, usageScene: 'ONLINE' },
    ];
    (0, vitest_1.it)('线上领券中心：取渠道含 CENTRE 且场景匹配的券', () => {
        const out = (0, coupon_channel_1.filterTemplatesByChannelAndScene)(list, 'CENTRE', 'ONLINE');
        (0, vitest_1.expect)(out).toEqual([list[0], list[2]]);
    });
    (0, vitest_1.it)('到店领券中心：排除仅线上的券', () => {
        const out = (0, coupon_channel_1.filterTemplatesByChannelAndScene)(list, 'CENTRE', 'IN_STORE');
        (0, vitest_1.expect)(out).toEqual([list[2]]);
    });
    (0, vitest_1.it)('显式仅 SALE 的券不出现在领券中心（老字段 claimable=true 不生效）', () => {
        const out = (0, coupon_channel_1.filterTemplatesByChannelAndScene)(list, 'CENTRE', 'ONLINE');
        (0, vitest_1.expect)(out).not.toContain(list[3]);
    });
    (0, vitest_1.it)('积分商城线上：仅取渠道含 POINTS 且场景匹配的券', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.filterTemplatesByChannelAndScene)(list, 'POINTS', 'ONLINE')).toEqual([list[2]]);
    });
    (0, vitest_1.it)('空数组返回空数组', () => {
        (0, vitest_1.expect)((0, coupon_channel_1.filterTemplatesByChannelAndScene)([], 'CENTRE', 'ONLINE')).toEqual([]);
    });
});
//# sourceMappingURL=coupon-channel.spec.js.map