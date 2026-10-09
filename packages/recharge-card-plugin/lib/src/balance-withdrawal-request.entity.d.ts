import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare class BalanceWithdrawalRequest extends VendureEntity {
    constructor(input?: DeepPartial<BalanceWithdrawalRequest>);
    customerId: number;
    amount: number;
    method: 'wechat' | 'alipay' | 'bank';
    accountInfo: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    remark: string | null;
    reviewedAt: Date;
    paidAt: Date;
    channel: Channel;
    channelId: number;
}
