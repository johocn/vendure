import { describe, expect, it } from 'vitest';
import { canGrantRole, dedupeRolesByLabel } from './tenant-member.service';

describe('canGrantRole', () => {
    const operator = new Set(['ReadProduct', 'UpdateProduct', 'ReadOrder']);

    it('子集可授', () => {
        expect(canGrantRole(operator, ['ReadProduct'])).toBe(true);
        expect(canGrantRole(operator, ['ReadProduct', 'UpdateProduct'])).toBe(true);
    });

    it('超出操作者权限不可授', () => {
        expect(canGrantRole(operator, ['ReadProduct', 'DeleteProduct'])).toBe(false);
        expect(canGrantRole(operator, ['CreateOrder'])).toBe(false);
    });

    it('含管理权限不可授（防链式提权）', () => {
        expect(canGrantRole(operator, ['ReadProduct', 'TenantMemberManage'])).toBe(false);
        expect(canGrantRole(operator, ['TenantRoleManage'])).toBe(false);
    });

    it('忽略 Authenticated 基础权限', () => {
        expect(canGrantRole(operator, ['Authenticated', 'ReadProduct'])).toBe(true);
    });

    it('空角色可授', () => {
        expect(canGrantRole(operator, [])).toBe(true);
    });
});

describe('dedupeRolesByLabel', () => {
    const local = (id: string, code: string, description: string) => ({ id, code, description });
    const global = (id: string, code: string, description: string) => ({ id, code: `g-${code}`, description });

    it('同名本地优先于全局', () => {
        const roles = [global('1', 'sales', '销售'), local('2', 't1-sales', '销售')];
        const out = dedupeRolesByLabel(roles);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('2');
    });

    it('不同名不合并', () => {
        const roles = [local('1', 't1-sales', '销售'), local('2', 't1-stock', '库存')];
        expect(dedupeRolesByLabel(roles)).toHaveLength(2);
    });

    it('description 为空时退回 code', () => {
        const roles = [local('1', 't1-sales', ''), global('2', 'sales', '')];
        const out = dedupeRolesByLabel(roles);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('1');
    });
});
