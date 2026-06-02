import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export declare class WithdrawalRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<WithdrawalRequest>);
    distributorId: string;
    amount: number;
    method: 'bank' | 'alipay' | 'wechat';
    accountInfo: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    reviewedAt: Date;
    paidAt: Date;
    channels: Channel[];
}
