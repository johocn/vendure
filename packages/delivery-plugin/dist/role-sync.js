"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleSyncService = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const loggerCtx = 'DeliveryRoleSync';
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
class RoleSyncService {
    init(injector) {
        this.connection = injector.get(core_1.TransactionalConnection);
        this.channelService = injector.get(core_1.ChannelService);
    }
    async syncRoles() {
        var _a;
        const roleRepo = this.connection.rawConnection.getRepository(core_1.Role);
        const defaultChannel = await this.channelService.getDefaultChannel();
        let syncedRoles = 0;
        let syncedPerms = 0;
        for (const [roleCode, permissions] of Object.entries(constants_1.ROLE_PERMISSIONS_MAP)) {
            let role = await roleRepo.findOne({
                where: { code: roleCode },
                relations: ['channels'],
            });
            if (!role) {
                role = new core_1.Role({
                    code: roleCode,
                    description: `Auto-synced role: ${roleCode}`,
                    permissions: [],
                });
                role.channels = defaultChannel ? [defaultChannel] : [];
                syncedRoles++;
                core_1.Logger.info(`Created role: ${roleCode}`, loggerCtx);
            }
            const existingPerms = new Set((_a = role.permissions) !== null && _a !== void 0 ? _a : []);
            for (const perm of permissions) {
                const typedPerm = perm;
                if (!existingPerms.has(typedPerm)) {
                    existingPerms.add(typedPerm);
                    syncedPerms++;
                }
            }
            role.permissions = Array.from(existingPerms);
            await roleRepo.save(role);
        }
        core_1.Logger.info(`Synced ${syncedRoles} roles, ${syncedPerms} permissions`, loggerCtx);
    }
}
exports.RoleSyncService = RoleSyncService;
