import { AdministratorService, Channel, ChannelService, ConfigService, RequestContext, RequestContextService, RoleService, SellerService, ShippingMethodService, StockLocationService, TransactionalConnection } from '@vendure/core';
import { CreateSellerInput } from './types';
export declare class MarketplaceSellerService {
    private administratorService;
    private sellerService;
    private roleService;
    private channelService;
    private shippingMethodService;
    private configService;
    private stockLocationService;
    private requestContextService;
    private connection;
    constructor(administratorService: AdministratorService, sellerService: SellerService, roleService: RoleService, channelService: ChannelService, shippingMethodService: ShippingMethodService, configService: ConfigService, stockLocationService: StockLocationService, requestContextService: RequestContextService, connection: TransactionalConnection);
    registerMarketplaceSeller(ctx: RequestContext, input: {
        shopName: string;
        seller: CreateSellerInput;
    }): Promise<Channel>;
    private createSellerShippingMethod;
    private createSellerStockLocation;
    private createSellerChannelRoleAdmin;
    private getSuperAdminContext;
}
