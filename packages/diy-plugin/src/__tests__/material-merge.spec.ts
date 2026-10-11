import { describe, expect, it } from 'vitest';

import { DiyMaterial } from '../entities/diy-material.entity';
import { mergeCategories, mergeMaterials, unionCategories } from '../material-merge';

function mat(p: Partial<DiyMaterial> & { id: number; code: string }): DiyMaterial {
    return {
        app: null,
        sourceMaterialId: null,
        name: { 'zh-CN': p.code },
        categoryId: 1,
        shape: 'round',
        diameter: 8,
        axialLength: null,
        holeSize: null,
        attrs: null,
        render: null,
        price: 100,
        priceUnit: 'piece',
        currency: 'CNY',
        stock: 0,
        images: null,
        enabled: true,
        sortOrder: 0,
        ...p,
    } as DiyMaterial;
}

describe('mergeMaterials', () => {
    const platform = [mat({ id: 1, code: 'A-AGS-08-N' }), mat({ id: 2, code: 'B-CRY-10-P' })];

    it('keeps all platform rows when tenant is empty', () => {
        expect(mergeMaterials(platform, [])).toHaveLength(2);
    });

    it('tenant copy shadows platform row by sourceMaterialId even if code differs', () => {
        const tenant = [mat({ id: 11, code: 'A-AGS-08-N2', sourceMaterialId: 1, app: 'nshop' })];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([2, 11]);
    });

    it('plain tenant row shadows platform row with the same code', () => {
        const tenant = [mat({ id: 12, code: 'B-CRY-10-P', app: 'nshop' })];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([1, 12]);
    });

    it('tenant-only rows are appended after kept platform rows', () => {
        const tenant = [
            mat({ id: 13, code: 'C-WOD-12-X', app: 'nshop' }),
            mat({ id: 11, code: 'A-AGS-08-N2', sourceMaterialId: 1, app: 'nshop' }),
        ];
        const merged = mergeMaterials(platform, tenant);
        expect(merged.map(m => m.id)).toEqual([2, 13, 11]);
    });
});

describe('mergeCategories', () => {
    it('is a pure union without shadowing', () => {
        const platform = [{ id: 1, code: 'crystal' }, { id: 2, code: 'agate' }] as any[];
        const tenant = [{ id: 9, code: 'wood', app: 'nshop' }] as any[];
        const merged = mergeCategories(platform as any, tenant as any);
        expect(merged).toHaveLength(3);
        expect(merged.map(c => c.id)).toEqual([1, 2, 9]);
    });
});

describe('unionCategories', () => {
    const row = (id: number, code: string | null, enabled = true, sortOrder = 0) =>
        ({ id, code, enabled, sortOrder });
    it('平台 + 租户并集，过滤 disabled 与无 code 行', () => {
        const r = unionCategories(
            [row(1, 'crystal'), row(2, 'agate', false), row(3, null)],
            [row(4, 'spacer'), row(5, 'metal', false)],
        );
        expect(r.map(c => c.code)).toEqual(['crystal', 'spacer']);
    });
    it('按 sortOrder 升序，同序按 id', () => {
        const r = unionCategories([row(2, 'b', true, 1), row(1, 'a', true, 1), row(3, 'c', true, 0)], []);
        expect(r.map(c => c.code)).toEqual(['c', 'a', 'b']);
    });
});
