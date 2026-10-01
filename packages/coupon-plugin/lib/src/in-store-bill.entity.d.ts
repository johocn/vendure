import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 到店买单流水：平台不收款、不生成线上订单，仅记录「商户线下收款 + 用券优惠」留痕。
 * 冗余券名/顾客名/折扣等快照，模板或顾客改名后仍可追溯。
 */
export declare class InStoreBill extends VendureEntity {
    constructor(input?: DeepPartial<InStoreBill>);
    /** 核销发生的租户渠道 id（流水按此隔离） */
    channelId: ID;
    /** 被核销的用户券 id（customer_coupon.id） */
    customerCouponId: number;
    /** 券码快照 */
    couponCode: string;
    /** 券模板 id 快照 */
    couponTemplateId: number;
    /** 券名快照（模板改名后仍可追溯） */
    couponName?: string;
    /** 顾客 id */
    customerId: number;
    /** 顾客名快照 */
    customerName?: string;
    /** 顾客手机号快照 */
    customerPhone?: string;
    /** 券类型快照：PERCENT | FIXED | FULL */
    discountType: string;
    /** 券折扣值快照：PERCENT 为折数（80 = 8 折），FIXED/FULL 为分 */
    discountValue: number;
    /** 原价（分），商户手填 */
    originalAmount: number;
    /** 优惠额（分） */
    discountAmount: number;
    /** 实付（分） */
    finalAmount: number;
    /** 核销管理员 id */
    operatorId: number;
    /** 核销人名称快照 */
    operatorName?: string;
    /** 备注 */
    remark?: string;
    /** 核销（买单）时间 */
    billedAt: Date;
}
