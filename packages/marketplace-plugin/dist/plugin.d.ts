import { OnApplicationBootstrap } from '@nestjs/common';
import { ChannelService, ConfigService, EntityHydrator, EventBus, RequestContextService, RoleService, TransactionalConnection } from '@vendure/core';
import { LedgerService } from './ledger.service';
import { MarketplacePluginOptions } from './types';
export declare class MarketplacePlugin implements OnApplicationBootstrap {
    private eventBus;
    private connection;
    private entityHydrator;
    private ledgerService;
    private roleService;
    private channelService;
    private configService;
    private requestContextService;
    static options: MarketplacePluginOptions;
    constructor(eventBus: EventBus, connection: TransactionalConnection, entityHydrator: EntityHydrator, ledgerService: LedgerService, roleService: RoleService, channelService: ChannelService, configService: ConfigService, requestContextService: RequestContextService);
    static init(options: MarketplacePluginOptions): typeof MarketplacePlugin;
    onApplicationBootstrap(): Promise<void>;
    /**
     * 幂等创建「平台运营」角色（code = platform-ops），用于接入 marketplace 审批等平台运营能力。
     */
    private ensurePlatformOpsRole;
    private getSuperAdminContext;
}
