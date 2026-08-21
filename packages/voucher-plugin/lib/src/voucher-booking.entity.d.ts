import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type BookingStatus = 'booked' | 'visited' | 'noShow' | 'cancelled';
export declare class VoucherBooking extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<VoucherBooking>);
    channelId: number;
    channels: Channel[];
    /** 预约档唯一关联到店券（幂等唯一）。 */
    voucherId: number;
    customerId: number;
    shopId: number;
    slotAt: Date;
    customerCount: number;
    status: BookingStatus;
}
