import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
export type RentUnit = 'day' | 'week' | 'month';
export type PrepaidOrPostpaid = 'prepaid' | 'postpaid';
/**
 * 租赁计划（variant 级配置）。
 * - depositAmount：押金（security_deposit 损失填补语义，不适用定金 20% 上限——设计 §3/§10）
 * - rentAmount / rentUnit：单位租金（分）
 * - prepaidOrPostpaid：prepaid = 租金下单时一次付清（rentAmount × periods）；postpaid = 按周期后付
 * - buyoutPrice：买断价快照基准（null = 未定价；实际买断款 = max(0, buyoutPrice - 已付租金)）
 * - 期次金额在 startRental 时按本计划快照生成，改配置不影响已生成订单
 */
export declare class RentalPlan extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<RentalPlan>);
    name: string;
    variantId: number;
    /** 押金（分，> 0） */
    depositAmount: number;
    /** 单位租金（分，> 0） */
    rentAmount: number;
    rentUnit: RentUnit;
    prepaidOrPostpaid: PrepaidOrPostpaid;
    /** 买断价（分，null = 不可定价买断） */
    buyoutPrice: number | null;
    allowBuyout: boolean;
    /** postpaid 租金期是否允许 COD（COD 仅限租金期——设计 §8；调度层 COD_ALLOWED_KINDS 兜底） */
    allowCod: boolean;
    enabled: boolean;
    channels: Channel[];
}
