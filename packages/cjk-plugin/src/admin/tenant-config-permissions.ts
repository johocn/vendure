import { PermissionDefinition } from '@vendure/core';

export const tenantConfigPermission = new PermissionDefinition({
    name: 'ManageTenantConfig',
    description: 'Manage tenant-level configuration (payment/auth/sso/map)',
    assignable: true,
});

// 用法: tenantConfigPermission.Permission 获取权限值(用于 @Allow 装饰器)
// super-admin 默认拥有所有权限;租户管理员通过 channel 关联隐式获得(运行时校验)
