import { Injector } from '@vendure/core';
export declare class RoleSyncService {
    private connection;
    private channelService;
    init(injector: Injector): void;
    syncRoles(): Promise<void>;
}
