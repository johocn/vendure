import { ID, OrderService, RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';
export declare class DeliveryShopResolver {
    private deliveryService;
    private orderService;
    private connection;
    constructor(deliveryService: DeliveryService, orderService: OrderService, connection: TransactionalConnection);
    myDeliveryAddresses(ctx: RequestContext): Promise<any[]>;
    createDeliveryAddress(ctx: RequestContext, input: any): Promise<any>;
    updateDeliveryAddress(ctx: RequestContext, id: ID, input: any): Promise<any>;
    deleteDeliveryAddress(ctx: RequestContext, id: ID): Promise<boolean>;
    setDefaultDeliveryAddress(ctx: RequestContext, id: ID): Promise<any[]>;
    shopDeliveryRange(ctx: RequestContext, shopId: ID): Promise<any>;
    validateDelivery(ctx: RequestContext, input: any): Promise<any[]>;
    activeOrderDeliveryStatus(ctx: RequestContext): Promise<any | null>;
    setOrderShippingFromAddress(ctx: RequestContext, deliveryAddressId: ID): Promise<any>;
    districtCodes(range: DeliveryRange): string[] | null;
}
