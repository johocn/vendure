import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { DeliveryStatus } from './delivery-provider';
export declare class DeliveryOrder extends VendureEntity {
    constructor(input?: DeepPartial<DeliveryOrder>);
    code: string;
    orderId: ID;
    packageId: string;
    fulfillmentId: ID | null;
    providerCode: string;
    thirdPartyNo: string;
    status: DeliveryStatus;
    pickupJson: string;
    dropoffJson: string;
    itemsJson: string;
    fee: number;
    etaMinutes: number;
    courierName: string;
    courierPhone: string;
    acceptedAt: Date;
    pickupAt: Date;
    deliveredAt: Date;
    cancelledAt: Date;
    reason: string;
}
