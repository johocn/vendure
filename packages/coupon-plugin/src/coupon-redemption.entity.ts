import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 券核销流水（到店核销留痕）。
 * 与 coupon_settlement_order 互补：本表记录「谁在哪个门店、何时、以何种方式核销了哪张券」，
 * 门店信息同时以快照形式落库，门店后续改名/关店不影响历史流水。
 */
@Entity()
export class CouponRedemption extends VendureEntity {
    constructor(input?: DeepPartial<CouponRedemption>) {
        super(input);
    }

    /** 用户券实例 id（CustomerCoupon.id） */
    @Index()
    @Column({ type: 'int' })
    customerCouponId: number;

    /** 券码（冗余便于按码查询） */
    @Column('varchar')
    couponCode: string;

    /** 券模板 id */
    @Column({ type: 'int' })
    templateId: number;

    /** 由出售单生成的券：指向出售单 id */
    @Column({ type: 'int', nullable: true })
    saleOrderId: number | null;

    /** 门店所属商户 id（merchant-plugin） */
    @Column({ type: 'int', nullable: true })
    merchantId: number | null;

    /** 核销门店 id */
    @Index()
    @Column({ type: 'int' })
    storeId: number;

    /** 所属渠道 */
    @Column({ type: 'int' })
    channelId: number;

    /** 核销方式：QR（扫码）/ MANUAL（手工，预留） */
    @Column('varchar', { default: 'QR' })
    redeemMode: string;

    /** 操作员（后台核销时记录） */
    @Column({ type: 'int', nullable: true })
    operatorId: number | null;

    @Column('varchar', { nullable: true })
    operatorName: string | null;

    /** 核销时间 */
    @Column({ type: Date })
    redeemedAt: Date;

    /** 撤销时间（预留） */
    @Column({ type: Date, nullable: true })
    revokedAt: Date | null;

    /** 撤销原因（预留） */
    @Column('varchar', { nullable: true })
    revokeReason: string | null;

    /** 核销金额（分，预留） */
    @Column({ type: 'int', nullable: true })
    amount: number | null;

    /** 门店快照：name/address/phoneNumber/businessHoursText/lat/lng */
    @Column('simple-json', { nullable: true })
    storeSnapshot: any | null;

    /** 设备信息（预留） */
    @Column('varchar', { nullable: true })
    deviceInfo: string | null;
}
