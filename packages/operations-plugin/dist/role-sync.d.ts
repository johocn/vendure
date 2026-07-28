import { Injector } from '@vendure/core';
/**
 * @description
 * Syncs predefined Roles and their Permission bindings at plugin bootstrap.
 * For existing Roles, only adds missing Permissions (incremental update).
 *
 * Note: ROLE_PERMISSIONS_MAP is defined in delivery-plugin/src/constants.ts and includes
 * the 4 new operations permissions (ManageBanner/Recommendation/Notice/Floor) appended to
 * operations-staff, manager, and super-admin roles.
 */
export declare class RoleSyncService {
    private connection;
    private channelService;
    init(injector: Injector): void;
    syncRoles(): Promise<void>;
}
