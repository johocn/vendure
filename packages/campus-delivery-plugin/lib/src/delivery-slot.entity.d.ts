import { DeepPartial, ID, VendureEntity } from '@vendure/core';
export declare class DeliverySlot extends VendureEntity {
    [key: string]: any;
    slotDate: string;
    startTime: string;
    endTime: string;
    zoneId: ID;
    capacity: number;
    lockedCount: number;
    active: boolean;
    channelId: ID;
    constructor(input?: DeepPartial<DeliverySlot>);
}
