import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { CouponIssuedBy, CouponStatus } from './types';
import { CouponTemplate } from './coupon-template.entity';
/**
 * 用户券：用户领取/被定向发放后的实例。
 */
export declare class CustomerCoupon extends VendureEntity {
    constructor(input?: DeepPartial<CustomerCoupon>);
    /** 归属用户（Customer.id） */
    customerId: number;
    /** 所属券模板（CouponTemplate.id） */
    templateId: number;
    /** 关联券模板 */
    template?: CouponTemplate;
    /** 唯一券码（可推广/展示） */
    code: string;
    /** 状态 */
    status: CouponStatus;
    /** 发券来源 */
    issuedBy: CouponIssuedBy;
    /** 预约锁定的订单 id */
    reservedOrderId?: ID;
    /** 已核销订单 id */
    usedOrderId?: ID;
    /** 领取时间 */
    issuedAt?: Date;
    /** 核销时间 */
    usedAt?: Date;
    /** 过期时间（快照模板 endsAt，回退/过期判定用） */
    expiredAt?: Date;
}
