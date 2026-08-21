import { AdministratorService, FulfillmentService, ID, Order, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';
import { PickupPluginOptions } from './constants';
import { PickupRedemption } from './pickup-redemption.entity';
export declare class PickupService {
    private options;
    private connection;
    private orderService;
    private fulfillmentService;
    private administratorService;
    constructor(options: PickupPluginOptions, connection: TransactionalConnection, orderService: OrderService, fulfillmentService: FulfillmentService, administratorService: AdministratorService);
    private genCode;
    private genUniqueCode;
    requireMyOrder(ctx: RequestContext, orderId: ID): Promise<Order>;
    requireMyShop(ctx: RequestContext): Promise<Shop>;
    private isPickupPaid;
    /**
     * 店归属强校验：被核销订单主商品的 Product.customFields.shopId 归店（与 settlement-plugin 阶段24
     * 按店拆账同一判据）。订单任一行商品归属本店即视为本店单，否则不归属。
     */
    private orderBelongsToShop;
    /** 懒生成/取回固定提货码（幂等：一生对一单）。 */
    resolveMyPickupCode(ctx: RequestContext, orderId: ID): Promise<PickupRedemption>;
    private getOrCreateRedemption;
    /** 核销闸门：校验凭据存在且 generated。 */
    private findGeneratable;
    /** 顾客自核销。 */
    claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption>;
    /** 店员核销（仅本店订单，跨店抛 Forbidden）。 */
    claimPickupByShop(ctx: RequestContext, code: string): Promise<PickupRedemption>;
    private commitRedeem;
    onOrderCancelled(orderId: number): Promise<void>;
    myPickupOrders(ctx: RequestContext, options?: any): Promise<[PickupRedemption[], number]>;
    private listRedemptions;
    allRedemptions(ctx: RequestContext, options?: any): Promise<{
        items: PickupRedemption[];
        totalItems: number;
    }>;
}
