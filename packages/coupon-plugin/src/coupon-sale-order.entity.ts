import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { CouponSalePayMode, CouponSaleStatus } from './types';

/**
 * 券出售单：独立单据，不生成 Vendure Order（对标 RechargeOrder）。
 * 金额单位：分。
 */
@Entity()
export class CouponSaleOrder extends VendureEntity {
    constructor(input?: DeepPartial<CouponSaleOrder>) {
        super(input);
    }

    @Index()
    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'varchar' })
    payMode: CouponSalePayMode;

    /** 单券出售时指向券模板 */
    @Column({ type: 'int', nullable: true })
    templateId: number | null;

    /** 券包出售时指向券包 */
    @Column({ type: 'int', nullable: true })
    bundleId: number | null;

    /** ORDER_SURCHARGE 时指向主订单 */
    @Column({ type: 'int', nullable: true })
    orderId: number | null;

    /** 加价购挂在主订单上的 Surcharge id（摘除用） */
    @Column({ type: 'int', nullable: true })
    surchargeId: number | null;

    @Column({ type: 'int' })
    amount: number;

    @Column({ type: 'varchar' })
    status: CouponSaleStatus;

    @Column({ type: 'varchar', nullable: true })
    paymentMethod: string | null;

    /** 网关商户单号 out_trade_no（幂等核对） */
    @Column({ type: 'varchar', nullable: true })
    externalRef: string | null;

    @Column({ nullable: true })
    paidAt?: Date;

    @Column({ nullable: true })
    refundedAt?: Date;

    @Column({ type: 'text', nullable: true })
    remark: string | null;

    @ManyToOne(() => Channel, { eager: false })
    channel: Channel;

    @Column()
    channelId: number;
}