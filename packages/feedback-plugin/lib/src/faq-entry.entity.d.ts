import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
export declare class FaqEntry extends VendureEntity {
    constructor(input?: DeepPartial<FaqEntry>);
    title: string;
    content: string;
    /** 分组：general/order/pay/afterSale/account */
    type: string;
    sort: number;
    enabled: boolean;
    /** 渠道隔离（仿 distribution WithdrawalRequest.channels，ListQueryBuilder channelId 过滤走此关系） */
    channels: Channel[];
}
