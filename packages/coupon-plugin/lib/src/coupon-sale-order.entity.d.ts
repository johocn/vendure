import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { CouponSalePayMode, CouponSaleStatus } from './types';
/**
 * 券出售单：独立单据，不生成 Vendure Order（对标 RechargeOrder）。
 * 金额单位：分。
 */
export declare class CouponSaleOrder extends VendureEntity {
    constructor(input?: DeepPartial<CouponSaleOrder>);
    customerId: number;
    payMode: CouponSalePayMode;
    /** 单券出售时指向券模板 */
    templateId: number | null;
    /** 券包出售时指向券包 */
    bundleId: number | null;
    /** ORDER_SURCHARGE 时指向主订单 */
    orderId: number | null;
    /** 加价购挂在主订单上的 Surcharge id（摘除用） */
    surchargeId: number | null;
    amount: number;
    status: CouponSaleStatus;
    paymentMethod: string | null;
    /** 网关商户单号 out_trade_no（幂等核对） */
    externalRef: string | null;
    paidAt?: Date;
    refundedAt?: Date;
    remark: string | null;
    channel: Channel;
    channelId: number;
}
