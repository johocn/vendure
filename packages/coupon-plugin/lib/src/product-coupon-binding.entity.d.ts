import { DeepPartial, VendureEntity } from '@vendure/core';
import { CouponTemplate } from './coupon-template.entity';
/**
 * 商品绑定券：运营层配置「某商品（可细化到多个 variant）可领取某张券模板」，
 * 结算时按 binding 集合判定订单行是否命中。channelId 用于租户隔离（大整数列）。
 */
export declare class ProductCouponBinding extends VendureEntity {
    constructor(input?: DeepPartial<ProductCouponBinding>);
    /** 商品 id（Product.id） */
    productId: number;
    /** 多规格细化；空=商品全 SKU */
    variantIds?: number[];
    /** 券模板 id（CouponTemplate.id） */
    couponTemplateId: number;
    /** 关联券模板 */
    template?: CouponTemplate;
    /** 启停（详情页展示需 binding.enabled && 模板 enabled && 模板 claimable） */
    enabled: boolean;
    /** 租户渠道 id（bigint，租户隔离过滤用） */
    channelId?: number;
    /** 展示排序（升序） */
    displayOrder: number;
    perUserClaimLimit?: number;
    claimWindowStart?: Date;
    claimWindowEnd?: Date;
    claimStock?: number;
    badgeText?: string;
    promoTitle?: string;
    remark?: string;
}
