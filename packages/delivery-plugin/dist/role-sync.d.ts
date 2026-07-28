import { Injector } from '@vendure/core';
/**
 * @description
 * 在插件 bootstrap 阶段同步预定义的 Role 及其 Permission 绑定。
 *
 * 设计说明：
 * - 直接使用 `TransactionalConnection.rawConnection.getRepository(Role)`，与 Vendure
 *   `RoleService.ensureRolesHaveValidPermissions` / `ensureSuperAdminRoleExists` 在 bootstrap
 *   阶段的写法一致，避免依赖 RequestContext（bootstrap 时无有效请求上下文）。
 * - 对已存在的 Role 只做「补绑缺失 Permission」的增量更新，不会删除已配置的额外 Permission，
 *   防止覆盖管理员手动的自定义配置。
 */
export declare class RoleSyncService {
    private connection;
    private channelService;
    init(injector: Injector): void;
    syncRoles(): Promise<void>;
}
