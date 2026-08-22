import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare class Supplier extends VendureEntity {
    constructor(input?: DeepPartial<Supplier>);
    code: string;
    name: string;
    taxNumber: string;
    contactName: string;
    contactPhone: string;
    address: string;
    /** 结账账期（天） */
    settlementDays: number;
    note: string;
    channelId: number;
    channels: Channel[];
}
