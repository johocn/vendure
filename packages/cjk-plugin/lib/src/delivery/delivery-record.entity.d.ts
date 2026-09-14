import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { DeliveryMode, DeliveryState } from './delivery-state';
export declare class DeliveryRecord extends VendureEntity {
    constructor(input?: DeepPartial<DeliveryRecord>);
    orderId: ID;
    fulfillmentId?: ID | null;
    sourceLocationId?: ID | null;
    mode: DeliveryMode;
    status: DeliveryState;
    expressCompany?: string | null;
    trackingNo?: string | null;
    staffId?: string | null;
    staffName?: string | null;
    receiverName?: string | null;
    receiverPhone?: string | null;
    receiverAddress?: string | null;
    lat?: number | null;
    lng?: number | null;
    pickupLocationId?: ID | null;
    fromLocationId?: ID | null;
    toLocationId?: ID | null;
    /** transfer 明细 [{variantId, quantity}] */
    itemsJson?: string | null;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    returnedAt?: Date | null;
    exceptionAt?: Date | null;
    photos?: string | null;
    remark?: string | null;
    orderBoxId?: string | null;
}
