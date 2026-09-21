import { describe, expect, it } from 'vitest';
import { modesFromMethodConfigs, bothSupported, modeFromCalculatorCode, unionCapability } from './delivery-capability';

describe('modesFromMethodConfigs 档案能力派生', () => {
    it('mail 模式 → MAIL', () => {
        expect(modesFromMethodConfigs([{ mode: 'mail' }])).toEqual(['MAIL']);
    });
    it('pickup 类三种模式都 → SELF_PICKUP', () => {
        expect(modesFromMethodConfigs([{ mode: 'pickup' }]).sort()).toEqual(['SELF_PICKUP']);
        expect(modesFromMethodConfigs([{ mode: 'store' }]).sort()).toEqual(['SELF_PICKUP']);
        expect(modesFromMethodConfigs([{ mode: 'employee' }]).sort()).toEqual(['SELF_PICKUP']);
    });
    it('两种模式 → 去重后双能力（MAIL 在前）', () => {
        expect(modesFromMethodConfigs([{ mode: 'pickup' }, { mode: 'mail' }, { mode: 'mail' }])).toEqual(['MAIL', 'SELF_PICKUP']);
    });
    it('无方法行 → 空数组（由调用方决定兜底）', () => {
        expect(modesFromMethodConfigs([])).toEqual([]);
        expect(modesFromMethodConfigs(null)).toEqual([]);
    });
    it('未知 mode 按非自提处理（mail 类），不抛错', () => {
        expect(modesFromMethodConfigs([{ mode: 'weird' }])).toEqual(['MAIL']);
    });
});

describe('bothSupported', () => {
    it('双能力才为 true', () => {
        expect(bothSupported(['MAIL', 'SELF_PICKUP'])).toBe(true);
        expect(bothSupported(['MAIL'])).toBe(false);
        expect(bothSupported([])).toBe(false);
    });
});

describe('modeFromCalculatorCode 存量档案缺方法行时的推断', () => {
    it('自提类计算器 → 对应自提 mode（与 pickupTypeByMode 对齐）', () => {
        expect(modeFromCalculatorCode('store-pickup-calculator')).toBe('store');
        expect(modeFromCalculatorCode('pickup-point-calculator')).toBe('pickup');
        expect(modeFromCalculatorCode('employee-pickup-calculator')).toBe('employee');
    });
    it('非自提计算器（如快递）→ mail', () => {
        expect(modeFromCalculatorCode('default-shipping-calculator')).toBe('mail');
    });
    it('未知/空计算器 → mail，不抛错', () => {
        expect(modeFromCalculatorCode(undefined)).toBe('mail');
        expect(modeFromCalculatorCode('')).toBe('mail');
    });
});

describe('渠道能力并集（存量档案场景）', () => {
    it('自提档案 + 缺方法行但绑定快递的租户默认档案 → 双能力，筛选条可见', () => {
        const pickupProfile = [{ mode: 'pickup' }];
        const courierProfileWithoutRows = [{ mode: modeFromCalculatorCode('default-shipping-calculator') }];
        const cap = unionCapability([pickupProfile, courierProfileWithoutRows, []]);
        expect(cap.modes).toEqual(['MAIL', 'SELF_PICKUP']);
        expect(cap.bothSupported).toBe(true);
        expect(cap.source).toBe('profile');
    });
    it('全部档案都无方法行 → 回退双能力（不误伤）', () => {
        expect(unionCapability([[], []])).toEqual({ modes: ['MAIL', 'SELF_PICKUP'], bothSupported: true, source: 'fallback' });
    });
});
