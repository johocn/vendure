import { OnApplicationBootstrap } from '@nestjs/common';
import { ChannelService, ConfigService, EntityHydrator, EventBus, FacetService, RequestContextService, RoleService, TransactionalConnection } from '@vendure/core';
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
    private facetService;
    static options: MarketplacePluginOptions;
    constructor(eventBus: EventBus, connection: TransactionalConnection, entityHydrator: EntityHydrator, ledgerService: LedgerService, roleService: RoleService, channelService: ChannelService, configService: ConfigService, requestContextService: RequestContextService, facetService: FacetService);
    static init(options: MarketplacePluginOptions): typeof MarketplacePlugin;
    onApplicationBootstrap(): Promise<void>;
    /**
     * 幂等初始化「品牌库」Facet（code = brand）。若已存在则跳过，否则创建并翻译为 zh_Hans「品牌」。
     * 整个方法用 try/catch 包裹：失败仅告警，绝不抛错阻塞启动。
     */
    private ensureBrandFacet;
    /**
     * 幂等创建「平台运营」角色（code = platform-ops），用于接入 marketplace 审批等平台运营能力。
     */
    private ensurePlatformOpsRole;
    private getSuperAdminContext;
}
