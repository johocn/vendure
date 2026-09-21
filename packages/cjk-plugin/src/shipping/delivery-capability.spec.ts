import { describe, expect, it } from 'vitest';
import { modesFromMethodConfigs, bothSupported } from './delivery-capability';

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
