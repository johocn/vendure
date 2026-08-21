import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type VoucherStatus = 'usable' | 'used' | 'expired' | 'refunded' | 'voided';
export declare class ServiceVoucher extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<ServiceVoucher>);
    channelId: number;
    channels: Channel[];
    /** 关联订单（按件生成，非唯一；幂等由 service existing 检查兜底）。 */
    orderId: number;
    customerId: number;
    shopId: number;
    productVariantId: number;
    productVoucherName: string;
    /** 核销码，唯一防碰撞。 */
    code: string;
    status: VoucherStatus;
    effectiveDays: number;
    expiresAt?: Date;
    usedAt?: Date;
    refundedAt?: Date;
}
