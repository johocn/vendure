import { PermissionDefinition } from '@vendure/core';

/**
 * 店主自营后台自定义权限：登录 admin API 的管理员必须持有该权限才能访问店主自营 resolver。
 * 归属隔离（按 Shop.administratorId）在 service 层二次把关。
 */
export const manageOwnShop = new PermissionDefinition({
    name: 'ManageOwnShop',
    description: 'Grants a merchant access to manage their own shop',
});

/** 店主角色分配的租户级权限：必须在插件配置中声明，否则 RoleService 会拒绝分配。 */
export const tenantSettingsManage = new PermissionDefinition({
    name: 'TenantSettingsManage',
    description: '管理本渠道租户配置（支付/地图/登录方式等）',
});

export const tenantPromotionManage = new PermissionDefinition({
    name: 'TenantPromotionManage',
    description: '管理本渠道营销活动（秒杀/拼团/预售）',
});