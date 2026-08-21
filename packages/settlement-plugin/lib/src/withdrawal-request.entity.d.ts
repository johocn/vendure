import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/** 提现申请：状态机 pending→approved→paid / pending→rejected。金额「分」整数。 */
export declare class WithdrawalRequest extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<WithdrawalRequest>);
    channelId: number;
    shopId: number;
    amount: number;
    /** pending | approved | paid | rejected */
    status: string;
    reviewNote: string | null;
    paidAt?: Date;
    channels: Channel[];
}
