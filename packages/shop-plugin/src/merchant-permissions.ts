import { PermissionDefinition } from '@vendure/core';

/**
 * 店主自营后台自定义权限：登录 admin API 的管理员必须持有该权限才能访问店主自营 resolver。
 * 归属隔离（按 Shop.administratorId）在 service 层二次把关。
 */
export const manageOwnShop = new PermissionDefinition({
    name: 'ManageOwnShop',
    description: 'Grants a merchant access to manage their own shop',
});