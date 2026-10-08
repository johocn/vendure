import { PermissionDefinition } from '@vendure/core';

/** 江湖域运营权限：审核情报、发布密信、处罚传信者 */
export const CAMPUS_JIANGHU_PERMISSION = new PermissionDefinition({
    name: 'CampusJianghu',
    description: '管理江湖域（密信/情报/段位/处罚）',
    internal: false,
});
