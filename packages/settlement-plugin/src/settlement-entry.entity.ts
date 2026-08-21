import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/** 结算明细：一次按店入账。orderId×shopId 唯一 → 幂等防重。金额「分」整数。 */
@Entity()
@Index(['orderId', 'shopId'], { unique: true })
export class SettlementEntry extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SettlementEntry>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'int' })
    shopId: number;

    @Column({ type: 'int' })
    orderId: number;

    @Column('varchar')
    orderCode: string;

    @Column({ type: 'int' })
    goodsAmountWithTax: number;

    @Column({ type: 'int' })
    shippingAmountWithTax: number;

    @Column({ type: 'int' })
    commissionAmount: number;

    @Column({ type: 'int' })
    netAmountWithTax: number;

    /** 可选 Date 列勿写死 type（阶段11 铁律）。 */
    @Column({ nullable: true })
    settledAt?: Date;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}