import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 券核销流水（到店核销留痕）。
 * 与 coupon_settlement_order 互补：本表记录「谁在哪个门店、何时、以何种方式核销了哪张券」，
 * 门店信息同时以快照形式落库，门店后续改名/关店不影响历史流水。
 */
export declare class CouponRedemption extends VendureEntity {
    constructor(input?: DeepPartial<CouponRedemption>);
    /** 用户券实例 id（CustomerCoupon.id） */
    customerCouponId: number;
    /** 券码（冗余便于按码查询） */
    couponCode: string;
    /** 券模板 id */
    templateId: number;
    /** 由出售单生成的券：指向出售单 id */
    saleOrderId: number | null;
    /** 门店所属商户 id（merchant-plugin） */
    merchantId: number | null;
    /** 核销门店 id */
    storeId: number;
    /** 所属渠道 */
    channelId: number;
    /** 核销方式：QR（扫码）/ MANUAL（手工，预留） */
    redeemMode: string;
    /** 操作员（后台核销时记录） */
    operatorId: number | null;
    operatorName: string | null;
    /** 核销时间 */
    redeemedAt: Date;
    /** 撤销时间（预留） */
    revokedAt: Date | null;
    /** 撤销原因（预留） */
    revokeReason: string | null;
    /** 核销金额（分，预留） */
    amount: number | null;
    /** 门店快照：name/address/phoneNumber/businessHoursText/lat/lng */
    storeSnapshot: any | null;
    /** 设备信息（预留） */
    deviceInfo: string | null;
}
