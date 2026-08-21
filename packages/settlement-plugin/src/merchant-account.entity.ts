import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/** 商家资金账户：一店一账户。金额一律「分」整数。 */
@Entity()
@Index(['channelId', 'shopId'], { unique: true })
export class MerchantAccount extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MerchantAccount>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'int' })
    shopId: number;

    /** 平台佣金率（%），可配置。 */
    @Column({ type: 'float', default: 0 })
    commissionRate: number;

    /** 可提现余额（分）。 */
    @Column({ type: 'int', default: 0 })
    availableBalance: number;

    /** 累计商品货款（分）。 */
    @Column({ type: 'int', default: 0 })
    totalGoodsAmount: number;

    /** 累计分摊运费（分）。 */
    @Column({ type: 'int', default: 0 })
    totalShippingAmount: number;

    /** 累计平台佣金（分）。 */
    @Column({ type: 'int', default: 0 })
    totalCommission: number;

    /** 累计已提现（分）。 */
    @Column({ type: 'int', default: 0 })
    totalWithdrawn: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}