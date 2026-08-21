import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class LiveRoomProduct extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<LiveRoomProduct>);
    variantId: string;
    name: string;
    price: number;
    imageUrl: string | null;
    sortOrder: number;
    channels: Channel[];
}
