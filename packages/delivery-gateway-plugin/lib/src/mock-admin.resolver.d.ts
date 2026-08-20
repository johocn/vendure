import { RequestContext } from '@vendure/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
export declare class MockAdminResolver {
    private deliveryGateway;
    constructor(deliveryGateway: DeliveryGatewayService);
    createDelivery(ctx: RequestContext, input: any): Promise<any>;
    deliveryOrders(ctx: RequestContext, orderId: string): Promise<any[]>;
    mockDeliveryEvent(ctx: RequestContext, deliveryOrderNo: string, status: string, courierName?: string, courierPhone?: string, reason?: string): Promise<boolean>;
    private toGraphQl;
}
