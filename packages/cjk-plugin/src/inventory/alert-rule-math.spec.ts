import { describe, expect, it } from 'vitest';
import { DEFAULT_SAFETY_STOCK, resolveSafetyStock } from './alert-rule-math';

describe('resolveSafetyStock（四级回退）', () => {
    const rules = [
        { variantId: 7, locationId: 3, safetyStock: 33, enabled: true },  // SKU×仓
        { variantId: 7, locationId: 0, safetyStock: 22, enabled: true },  // SKU 全仓
        { variantId: 8, locationId: 0, safetyStock: 11, enabled: true },
        { variantId: 9, locationId: 0, safetyStock: 44, enabled: false }, // 停用 → 跳过
    ];

    it('① 命中 SKU×仓规则（优先级最高）', () => {
        expect(resolveSafetyStock({ variantId: 7, locationId: 3, rules, channelDefault: 5 })).toBe(33);
    });

    it('② 无仓级规则 → 回退 SKU 全仓规则', () => {
        expect(resolveSafetyStock({ variantId: 7, locationId: 9, rules, channelDefault: 5 })).toBe(22);
    });

    it('聚合视图（locationId 空）跳过仓级、直接取全仓规则', () => {
        expect(resolveSafetyStock({ variantId: 7, locationId: null, rules, channelDefault: 5 })).toBe(22);
    });

    it('③ 无任何 SKU 规则 → 回退渠道默认值', () => {
        expect(resolveSafetyStock({ variantId: 42, locationId: 3, rules, channelDefault: 17 })).toBe(17);
    });

    it('渠道默认值为 0 时视为有效（不落到常量 10）', () => {
        expect(resolveSafetyStock({ variantId: 42, locationId: 3, rules, channelDefault: 0 })).toBe(0);
    });

    it('④ 渠道默认值缺失/非法 → 常量 10', () => {
        expect(resolveSafetyStock({ variantId: 42, locationId: 3, rules, channelDefault: null })).toBe(DEFAULT_SAFETY_STOCK);
        expect(resolveSafetyStock({ variantId: 42, locationId: 3, rules, channelDefault: undefined })).toBe(DEFAULT_SAFETY_STOCK);
        expect(resolveSafetyStock({ variantId: 42, locationId: 3, rules, channelDefault: Number.NaN })).toBe(DEFAULT_SAFETY_STOCK);
    });

    it('停用的 SKU 规则被忽略，继续向下回退', () => {
        expect(resolveSafetyStock({ variantId: 9, locationId: 0, rules, channelDefault: 6 })).toBe(6);
    });

    it('规则里的 safetyStock 为 0 时原样返回（关闭预警）', () => {
        const z = [{ variantId: 7, locationId: 0, safetyStock: 0, enabled: true }];
        expect(resolveSafetyStock({ variantId: 7, locationId: 0, rules: z, channelDefault: 5 })).toBe(0);
    });

    it('负数/非数安全库存被规整为 0，不产生负阈值', () => {
        const bad = [{ variantId: 7, locationId: 0, safetyStock: -3, enabled: true }];
        expect(resolveSafetyStock({ variantId: 7, locationId: 0, rules: bad, channelDefault: null })).toBe(0);
    });

    it('variantId 数字/字符串混用仍能命中（避免前后端 ID 类型不一致导致漏匹配）', () => {
        expect(resolveSafetyStock({ variantId: '7', locationId: '0', rules, channelDefault: 5 })).toBe(22);
    });
});