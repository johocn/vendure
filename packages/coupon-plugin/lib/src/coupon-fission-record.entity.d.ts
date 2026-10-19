import { DeepPartial, VendureEntity } from '@vendure/core';
import { CustomerCoupon } from './customer-coupon.entity';
/**
 * 分享裂变记录（FR-C）：
 * 同渠道同被分享者仅一条（唯一索引）——既是「同被分享者同活动仅 1 次」的规则载体，
 * 也是发放幂等（R3）的原子保障：发券与落记录同事务，唯一冲突即整体回滚。
 */
export declare class CouponFissionRecord extends VendureEntity {
    constructor(input?: DeepPartial<CouponFissionRecord>);
    /** 渠道（租户）id */
    channelId: number;
    /** 分享者（Customer.id） */
    inviterCustomerId: number;
    /** 被分享者（Customer.id） */
    inviteeCustomerId: number;
    /** 被分享者奖励券（CustomerCoupon.id；SOLD_OUT 等未发券为 null） */
    inviteeCouponId: number | null;
    /** 分享者奖励券（CustomerCoupon.id；超上限/未配置/售罄为 null） */
    inviterCouponId: number | null;
    /** 记录状态：OK=双方或单方发券成功；BLOCKED_NEW_CUSTOMER=限新客被拦（不再重试） */
    status: string;
    /** 首次分享时间 */
    sharedAt?: Date;
    /** 关联券（展示用） */
    inviteeCoupon?: CustomerCoupon;
}
