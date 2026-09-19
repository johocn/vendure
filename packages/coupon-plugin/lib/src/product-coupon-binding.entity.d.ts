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
    /** 预留：每人限领覆盖 */
    perUserClaimLimit?: number;
    /** 预留：专属领券时间窗 */
    claimWindowStart?: Date;
    claimWindowEnd?: Date;
    /** 预留：独立领券库存 */
    claimStock?: number;
    /** 角标文案 */
    badgeText?: string;
    /** 主文案 */
    promoTitle?: string;
    /** 备注 */
    remark?: string;
}
