import { Injector } from '@vendure/core';
/**
 * @description
 * 在插件 bootstrap 阶段同步预定义的 Role 及其 Permission 绑定。
 * 对已存在的 Role 只做「补绑缺失 Permission」的增量更新。
 */
export declare class RoleSyncService {
    private connection;
    private channelService;
    init(injector: Injector): void;
    syncRoles(): Promise<void>;
}
