import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
/** 周期购实例（买家）：状态机 draft → active → renewalPending → expired | active → cancelled。金额一律「分」。 */
export declare class Subscription extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Subscription>);
    channelId: number;
    code: string;
    planId: number;
    shopId: number;
    customerId: number;
    /** 排期日期列表（每个日期一个期次）。simple-json。 */
    scheduleJson: string[];
    startDate?: Date;
    endDate?: Date;
    /** 预存款余额（分）。 */
    prepaidBalance: number;
    /** 买断总收款（分）。 */
    purchasedTotal: number;
    /** 买断主订单 id。 */
    payOrderId?: number;
    status: string;
    channels: Channel[];
}
