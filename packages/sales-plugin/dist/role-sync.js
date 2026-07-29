"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleSyncService = void 0;
// e:\code\vendure\packages\sales-plugin\src\role-sync.ts
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const loggerCtx = 'SalesRoleSync';
/**
 * @description
 * 在插件 bootstrap 阶段同步预定义的 Role 及其 Permission 绑定。
 * 对已存在的 Role 只做「补绑缺失 Permission」的增量更新。
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
