import { RequestContext, AdministratorService } from '@vendure/core';
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
export declare class PermissionAdminResolver {
    private administratorService;
    constructor(administratorService: AdministratorService);
    myPermissions(ctx: RequestContext): Promise<{
        roles: string[];
        permissions: string[];
        visibleModules: {
            code: string;
            name: string;
            enabled: boolean;
            entryPath: string;
            icon: string;
            sort: number;
        }[];
    }>;
}
