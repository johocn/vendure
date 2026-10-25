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
    /** 打款流水号（通过时必填，用于对账留痕） */
    payoutRef: string | null;
    /** 打款凭证（转账截图/回单 URL） */
    payoutProof: string | null;
    constructor(input?: DeepPartial<RiderWithdrawalRequest>);
}
