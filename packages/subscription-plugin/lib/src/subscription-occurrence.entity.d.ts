import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/** 期次：第 1..N 期。状态机 pending → orderCreated | skipped | cancelled。幂等：subscriptionId×periodNo 唯一。 */
export declare class SubscriptionOccurrence extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SubscriptionOccurrence>);
    channelId: number;
    subscriptionId: number;
    periodNo: number;
    scheduledDate: Date;
    /** 卖家逐期指定内容 [{variantId,quantity}]（可从模板改）。simple-json。 */
    sellerItemsJson?: Array<{
        variantId: string | number;
        quantity: number;
    }>;
    generatedOrderId?: number;
    orderCode?: string;
    /** 跳过原因（卖家未指定 / 库存不足）。 */
    skipReason?: string;
    status: string;
    channels: Channel[];
}
