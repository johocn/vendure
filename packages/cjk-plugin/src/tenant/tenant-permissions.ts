import { PermissionDefinition } from '@vendure/core';

/** 超管租户管理（仅 SuperAdmin 角色持有） */
export const TenantManagePermission = 'TenantManage';
/** 租户级角色管理（租户管理员角色持有） */
export const TenantRoleManagePermission = 'TenantRoleManage';
/** 租户级人员管理（租户管理员角色持有） */
export const TenantMemberManagePermission = 'TenantMemberManage';
/** 订单核销（预留，本轮仅定义不实现） */
export const VerifyOrderPermission = 'VerifyOrder';

export const tenantPermissionDefinitions: PermissionDefinition[] = [
    new PermissionDefinition({ name: TenantManagePermission, description: '管理租户（超管）' }),
    new PermissionDefinition({ name: TenantRoleManagePermission, description: '管理租户角色' }),
    new PermissionDefinition({ name: TenantMemberManagePermission, description: '管理租户内部人员' }),
    new PermissionDefinition({ name: VerifyOrderPermission, description: '核销订单（预留）' }),
];
