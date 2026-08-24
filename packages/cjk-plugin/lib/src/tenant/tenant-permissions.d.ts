import { PermissionDefinition } from '@vendure/core';
/** 超管租户管理（仅 SuperAdmin 角色持有） */
export declare const TenantManagePermission = "TenantManage";
/** 租户级角色管理（租户管理员角色持有） */
export declare const TenantRoleManagePermission = "TenantRoleManage";
/** 租户级人员管理（租户管理员角色持有） */
export declare const TenantMemberManagePermission = "TenantMemberManage";
/** 订单核销（预留，本轮仅定义不实现） */
export declare const VerifyOrderPermission = "VerifyOrder";
export declare const tenantManagePermission: PermissionDefinition;
export declare const tenantRoleManagePermission: PermissionDefinition;
export declare const tenantMemberManagePermission: PermissionDefinition;
export declare const verifyOrderPermission: PermissionDefinition;
export declare const tenantPermissionDefinitions: PermissionDefinition[];
