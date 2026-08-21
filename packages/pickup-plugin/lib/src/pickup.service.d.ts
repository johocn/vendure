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
    /** 懒生成/取回固定提货码（幂等：一生对一单）。 */
    resolveMyPickupCode(ctx: RequestContext, orderId: ID): Promise<PickupRedemption>;
    private getOrCreateRedemption;
    /** 核销闸门：校验凭据存在且 generated。 */
    private findGeneratable;
    /** 顾客自核销。 */
    claimMyPickup(ctx: RequestContext, orderId: ID, code: string): Promise<PickupRedemption>;
    /** 店员核销（本店订单）。 */
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
