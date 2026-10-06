import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class RiderWithdrawalRequest extends VendureEntity {
    [key: string]: any;
    customerId: number;
    channelId: number;
    amount: number;
    channel: string;
    account: string;
    status: 'PENDING' | 'PAID' | 'REJECTED';
    remark: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    constructor(input?: DeepPartial<RiderWithdrawalRequest>);
}
