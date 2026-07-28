import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, AdministratorService } from '@vendure/core';
import { SUPER_ADMIN_ROLE_CODE } from '@vendure/common/lib/shared-constants';

import { DeliveryPermissions, MODULE_CONFIGS } from './constants';

/**
 * @description
 * Admin API resolver：返回当前登录 administrator 的角色、权限及可见模块列表。
 *
 * 设计说明：
 * - 用 `@Allow(Permission.Authenticated)` 而非具体业务权限，任何已登录 administrator 均可调用，
 *   用于前端初始化时拉取自身权限快照。
 * - 使用 `findOneByUserId` 而非 `findOne`：`ctx.activeUserId` 是 User ID，不是 Administrator ID。
 * - 显式传入 relations `['user', 'user.roles']`：`findOneByUserId` 不像 `findOne` 那样默认加载。
 * - super-admin 识别三种信号：delivery-plugin 自定义 `super-admin` role、Vendure 内置
 *   `__super_admin_role__` role、或拥有 `Permission.SuperAdmin` 权限，任一命中即视为 super-admin，
 *   自动拥有全部 `DeliveryPermissions`。
 */
@Resolver()
export class PermissionAdminResolver {
    constructor(private administratorService: AdministratorService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myPermissions(@Ctx() ctx: RequestContext) {
        if (!ctx.activeUserId) {
            return { roles: [], permissions: [], visibleModules: [] };
        }

        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId, [
            'user',
            'user.roles',
        ]);
        if (!admin || !admin.user) {
            return { roles: [], permissions: [], visibleModules: [] };
        }

        const roles = admin.user.roles?.map(r => r.code) ?? [];
        const permissions = new Set<string>();
        for (const role of admin.user.roles ?? []) {
            for (const perm of role.permissions ?? []) {
                permissions.add(perm);
            }
        }

        // super-admin 角色自动拥有所有 DeliveryPermissions
        const isSuperAdmin =
            roles.includes('super-admin') ||
            roles.includes(SUPER_ADMIN_ROLE_CODE) ||
            permissions.has(Permission.SuperAdmin);

        if (isSuperAdmin) {
            Object.values(DeliveryPermissions).forEach(p => permissions.add(p));
        }

        const permArray = Array.from(permissions);
        const visibleModules = MODULE_CONFIGS.filter(
            m => m.enabled && (m.perms.length === 0 || m.perms.some(p => permArray.includes(p))),
        ).map(m => ({
            code: m.code,
            name: m.name,
            enabled: m.enabled,
            entryPath: m.entryPath,
            icon: m.icon,
            sort: m.sort,
        }));

        return {
            roles,
            permissions: permArray,
            visibleModules,
        };
    }
}
