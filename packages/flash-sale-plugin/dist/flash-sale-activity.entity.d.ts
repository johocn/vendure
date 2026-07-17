import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class FlashSaleActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<FlashSaleActivity>);
    name: string;
    startAt: Date;
    endAt: Date;
    flashPrice: number;
    totalStock: number;
    soldCount: number;
    limitPerUser: number;
    productId: number;
    variantId: number;
    status: 'upcoming' | 'active' | 'ended';
    channels: Channel[];
}
