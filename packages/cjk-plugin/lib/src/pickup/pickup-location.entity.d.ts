import { ChannelAware, Channel, DeepPartial, HasCustomFields, ID, VendureEntity } from '@vendure/core';
declare class CustomPickupLocationFields {
}
export declare class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>);
    name: string;
    type: 'store' | 'point' | 'employee';
    address: string;
    phoneNumber: string;
    businessHours: string;
    coordinates: {
        lat: number;
        lng: number;
    } | null;
    partner: string;
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    isPublic: boolean;
    ownerChannelId: ID | null;
    channels: Channel[];
    customFields: CustomPickupLocationFields;
}
export {};
