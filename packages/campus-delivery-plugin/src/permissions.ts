import { PermissionDefinition } from '@vendure/core';

export const CampusPermissions = {
    CampusConfig: 'CampusConfig', // 分区/宿舍楼/履约配置
    CampusAuditRider: 'CampusAuditRider', // 骑手审核
    CampusViewDispatch: 'CampusViewDispatch', // 调度看板
    CampusMerchant: 'CampusMerchant', // 商家接单工作台（商家角色专用）
} as const;

export const campusPermissionDefinitions: PermissionDefinition[] = [
    { name: 'CampusConfig', description: '校园履约配置' },
    { name: 'CampusAuditRider', description: '骑手招募审核' },
    { name: 'CampusViewDispatch', description: '配送调度看板' },
    { name: 'CampusMerchant', description: '商家接单工作台' },
].map(p => new PermissionDefinition(p));
