// e:\code\vendure\packages\operations-plugin\src\role-sync.ts
import { ChannelService, Injector, Logger, Permission, Role, TransactionalConnection } from '@vendure/core';
import { ROLE_PERMISSIONS_MAP } from '@vendure/delivery-plugin';

const loggerCtx = 'OperationsRoleSync';

/**
 * @description
 * Syncs predefined Roles and their Permission bindings at plugin bootstrap.
 * For existing Roles, only adds missing Permissions (incremental update).
 *
 * Note: ROLE_PERMISSIONS_MAP is defined in delivery-plugin/src/constants.ts and includes
 * the 4 new operations permissions (ManageBanner/Recommendation/Notice/Floor) appended to
 * operations-staff, manager, and super-admin roles.
 */
export class RoleSyncService {
    private connection: TransactionalConnection;
    private channelService: ChannelService;

    init(injector: Injector): void {
        this.connection = injector.get(TransactionalConnection);
        this.channelService = injector.get(ChannelService);
    }

    async syncRoles(): Promise<void> {
        const roleRepo = this.connection.rawConnection.getRepository(Role);
        const defaultChannel = await this.channelService.getDefaultChannel();

        let syncedRoles = 0;
        let syncedPerms = 0;

        for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS_MAP)) {
            let role = await roleRepo.findOne({
                where: { code: roleCode },
                relations: ['channels'],
            });

            if (!role) {
                role = new Role({
                    code: roleCode,
                    description: `Auto-synced role: ${roleCode}`,
                    permissions: [],
                });
                role.channels = defaultChannel ? [defaultChannel] : [];
                syncedRoles++;
                Logger.info(`Created role: ${roleCode}`, loggerCtx);
            }

            const existingPerms = new Set<Permission>(role.permissions ?? []);
            for (const perm of permissions) {
                const typedPerm = perm as Permission;
                if (!existingPerms.has(typedPerm)) {
                    existingPerms.add(typedPerm);
                    syncedPerms++;
                }
            }
            role.permissions = Array.from(existingPerms);
            await roleRepo.save(role);
        }

        Logger.info(`Synced ${syncedRoles} roles, ${syncedPerms} permissions`, loggerCtx);
    }
}
