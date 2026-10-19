import { describe, expect, it } from 'vitest';

import { localizeFissionText, parseCouponFissionConfig, resolveActiveFission } from './coupon-fission';

describe('分享裂变纯函数（FR-C）', () => {
    const tpl = (id: number) => ({ id, name: `tpl-${id}` });

    it('parseCouponFissionConfig：坏 JSON / 非对象 / 空值 → null；字段规整', () => {
        expect(parseCouponFissionConfig(null)).toBeNull();
        expect(parseCouponFissionConfig('')).toBeNull();
        expect(parseCouponFissionConfig('not-json')).toBeNull();
        expect(parseCouponFissionConfig('[1]')).toBeNull();
        const cfg = parseCouponFissionConfig(
            '{"enabled":true,"name":"邀好友","endsAt":"2026-10-26T20:00:00+08:00","inviteeTemplateId":"83","inviterRewardLimit":"3"}',
        );
        expect(cfg).toEqual({
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

    it('resolveActiveFission：窗口判定 + 被分享者奖励必填 + 命中过滤', () => {
        const raw = {
            enabled: true,
            name: '邀好友得券',
            endsAt: '2026-10-26T12:00:00Z',
            inviteeTemplateId: 83,
            inviterTemplateId: 84,
        };
        const view = resolveActiveFission(raw, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        expect(view?.inviteeTemplate.id).toBe(83);
        expect(view?.inviterTemplate?.id).toBe(84);
        // 未开始
        expect(
            resolveActiveFission({ ...raw, startsAt: '2026-12-01T00:00:00Z' }, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans'),
        ).toBeNull();
        // 已结束 / 缺 endsAt（视为未配置完整）
        expect(resolveActiveFission(raw, [tpl(83), tpl(84)], new Date('2026-10-27T00:00:00Z'), 'zh_Hans')).toBeNull();
        expect(resolveActiveFission({ ...raw, endsAt: null }, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 缺被分享者奖励模板
        expect(resolveActiveFission({ ...raw, inviteeTemplateId: 0 }, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // 奖励模板不在本店目录
        expect(resolveActiveFission(raw, [tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        // disabled / 无文案
        expect(resolveActiveFission({ ...raw, enabled: false }, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
        expect(resolveActiveFission({ ...raw, name: '' }, [tpl(83), tpl(84)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans')).toBeNull();
    });

    it('resolveActiveFission：inviterTemplate 不在目录 → 仅被分享者奖励', () => {
        const raw = { enabled: true, name: 'x', endsAt: '2026-10-26T12:00:00Z', inviteeTemplateId: 83, inviterTemplateId: 999 };
        const view = resolveActiveFission(raw, [tpl(83)], new Date('2026-10-24T00:00:00Z'), 'zh_Hans');
        expect(view?.inviteeTemplate.id).toBe(83);
        expect(view?.inviterTemplate).toBeNull();
    });

    it('localizeFissionText：精确 lang → 去地区码 → 首个非空', () => {
        expect(localizeFissionText('直接文案', 'zh_Hans')).toBe('直接文案');
        expect(localizeFissionText({ zh_Hans: '中', en: 'en' }, 'zh_Hans')).toBe('中');
        expect(localizeFissionText({ zh: '中简', en: 'en' }, 'zh_Hans')).toBe('中简');
        expect(localizeFissionText({ en: 'en' }, 'zh_Hans')).toBe('en');
        expect(localizeFissionText({ en: '' }, 'zh_Hans')).toBeNull();
        expect(localizeFissionText(null, 'zh_Hans')).toBeNull();
    });
});
