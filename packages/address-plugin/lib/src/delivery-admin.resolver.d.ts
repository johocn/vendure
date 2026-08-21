import { ID, RequestContext } from '@vendure/core';
import { DeliveryRange } from './delivery-range.entity';
import { DeliveryService } from './delivery.service';
export declare class DeliveryAdminResolver {
    private deliveryService;
    constructor(deliveryService: DeliveryService);
    deliveryRange(ctx: RequestContext, shopId: ID): Promise<any>;
    upsertDeliveryRange(ctx: RequestContext, input: any): Promise<DeliveryRange>;
    districtCodes(range: DeliveryRange): string[] | null;
}
