import { ChannelAware, Channel, DeepPartial, HasCustomFields, VendureEntity } from '@vendure/core';
declare class CustomPickupLocationFields {
}
export declare class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>);
    name: string;
    type: 'store' | 'point';
    address: string;
    phoneNumber: string;
    businessHours: string;
    coordinates: {
        lat: number;
        lng: number;
    } | null;
    partner: string;
    channels: Channel[];
    customFields: CustomPickupLocationFields;
}
export {};
