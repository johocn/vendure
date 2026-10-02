import { describe, expect, it } from 'vitest';

import {
    filterTemplatesByChannelAndScene,
    hasChannel,
    matchesScene,
    parseDistributionChannels,
    resolveCouponChannels,
} from './coupon-channel';

const legacy = (over: Partial<Record<string, unknown>> = {}) => ({
    distributionChannels: null,
    claimable: false,
    pointsPrice: 0,
    claimCode: null,
    usageScene: 'ONLINE',
    ...over,
});

describe('parseDistributionChannels', () => {
    it('解析逗号分隔渠道并去重、去空白、忽略未知代号', () => {
        expect(parseDistributionChannels(' centre , SALE ,centre,BOGUS, POINTS ')).toEqual([
            'CENTRE',
            'SALE',
            'POINTS',
        ]);
    });

    it('null / undefined / 空串返回空数组', () => {
        expect(parseDistributionChannels(null)).toEqual([]);
        expect(parseDistributionChannels(undefined)).toEqual([]);
        expect(parseDistributionChannels('')).toEqual([]);
    });
});

describe('resolveCouponChannels', () => {
    it('显式配置优先，且不再叠加老字段推导', () => {
        const tpl = { distributionChannels: 'SALE', claimable: true, pointsPrice: 300, claimCode: 'X' };
        expect(resolveCouponChannels(tpl, true)).toEqual(['SALE']);
    });

    it('历史券（无显式配置）由老字段推导', () => {
        const tpl = { distributionChannels: null, claimable: true, pointsPrice: 300, claimCode: 'NEW2026' };
        expect(resolveCouponChannels(tpl, true)).toEqual(['CENTRE', 'POINTS', 'CODE', 'PRODUCT']);
    });

    it('历史券无任何来源时返回空数组（GRANT 无历史推导来源）', () => {
        expect(resolveCouponChannels(legacy(), false)).toEqual([]);
    });

    it('空白字符串的显式配置等同未配置，回落老字段', () => {
        const tpl = { distributionChannels: '  ', claimable: true, pointsPrice: 0, claimCode: null };
        expect(resolveCouponChannels(tpl, false)).toEqual(['CENTRE']);
    });

    it('全部为未知代号时视为无效配置，回落老字段', () => {
        const tpl = { distributionChannels: 'FOO,BAR', claimable: true, pointsPrice: 0, claimCode: null };
        expect(resolveCouponChannels(tpl, false)).toEqual(['CENTRE']);
    });
});

describe('hasChannel', () => {
    it('显式含 PRODUCT 时即便没有绑券也算命中', () => {
        const tpl = { distributionChannels: 'PRODUCT', claimable: false, pointsPrice: 0, claimCode: null };
        expect(hasChannel(tpl, false, 'PRODUCT')).toBe(true);
    });

    it('显式不含 CENTRE 时老字段 claimable 不生效', () => {
        const tpl = { distributionChannels: 'SALE', claimable: true, pointsPrice: 0, claimCode: null };
        expect(hasChannel(tpl, false, 'CENTRE')).toBe(false);
    });
});

describe('matchesScene', () => {
    it('ALL 同时匹配线上与到店', () => {
        expect(matchesScene('ALL', 'ONLINE')).toBe(true);
        expect(matchesScene('ALL', 'IN_STORE')).toBe(true);
    });

    it('ONLINE 不匹配到店，IN_STORE 不匹配线上', () => {
        expect(matchesScene('ONLINE', 'IN_STORE')).toBe(false);
        expect(matchesScene('IN_STORE', 'ONLINE')).toBe(false);
    });

    it('null / undefined 按 ONLINE 处理（历史数据语义）', () => {
        expect(matchesScene(null, 'ONLINE')).toBe(true);
        expect(matchesScene(undefined, 'IN_STORE')).toBe(false);
    });
});

describe('filterTemplatesByChannelAndScene', () => {
    const list = [
        legacy({ claimable: true, usageScene: 'ONLINE' }),
        legacy({ pointsPrice: 500, usageScene: 'IN_STORE' }),
        { distributionChannels: 'CENTRE,POINTS', claimable: false, pointsPrice: 0, claimCode: null, usageScene: 'ALL' },
        { distributionChannels: 'SALE', claimable: true, pointsPrice: 900, claimCode: null, usageScene: 'ONLINE' },
    ];

    it('线上领券中心：取渠道含 CENTRE 且场景匹配的券', () => {
        const out = filterTemplatesByChannelAndScene(list, 'CENTRE', 'ONLINE');
        expect(out).toEqual([list[0], list[2]]);
    });

    it('到店领券中心：排除仅线上的券', () => {
        const out = filterTemplatesByChannelAndScene(list, 'CENTRE', 'IN_STORE');
        expect(out).toEqual([list[2]]);
    });

    it('显式仅 SALE 的券不出现在领券中心（老字段 claimable=true 不生效）', () => {
        const out = filterTemplatesByChannelAndScene(list, 'CENTRE', 'ONLINE');
        expect(out).not.toContain(list[3]);
    });

    it('积分商城线上：仅取渠道含 POINTS 且场景匹配的券', () => {
        expect(filterTemplatesByChannelAndScene(list, 'POINTS', 'ONLINE')).toEqual([list[2]]);
    });

    it('空数组返回空数组', () => {
        expect(filterTemplatesByChannelAndScene([], 'CENTRE', 'ONLINE')).toEqual([]);
    });
});