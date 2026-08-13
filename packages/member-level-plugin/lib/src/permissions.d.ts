import { CrudPermissionDefinition } from '@vendure/core';
/**
 * MemberLevel 插件独立权限定义（CRUD 四权限）。
 * 用法：@Allow(memberLevelPermission.Read) / @Allow(memberLevelPermission.Update)
 * 注册：config.authOptions.customPermissions = [memberLevelPermission]
 *
 * 生成的权限名：CreateMemberLevel / ReadMemberLevel / UpdateMemberLevel / DeleteMemberLevel
 * 替换原 DeliveryPermissions.ManageMember 的硬耦合。
 */
export declare const memberLevelPermission: CrudPermissionDefinition;
