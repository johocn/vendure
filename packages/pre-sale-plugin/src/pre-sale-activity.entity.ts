import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type PreSaleMode = 'deposit' | 'full';
export type PreSaleStatus = 'upcoming' | 'active' | 'delivered' | 'ended';

/**
 * 预售活动。
 * 支持三种模式：
 * - full（全款预售）：预售期一次性收全款 → 到货后发货
 * - deposit（定金预售）：先收定金 → 到货/尾款窗口开启后收尾款 → 补齐后发货
 * - 预售价格分档：presalePrice < 原价，结算期 Promotion 动态打折到预售价
 */
@Entity()
export class PreSaleActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<PreSaleActivity>) {
        super(input);
    }

    @Column('varchar')
    name: string;

    /** deposit（定金）/ full（全款） */
    @Column('varchar')
    mode: PreSaleMode;

    @Column()
    startAt: Date;

    @Column()
    endAt: Date;

    /** 到货/开售时间（尾款开启或全款发货 latch） */
    @Column({ type: 'datetime', nullable: true })
    releaseAt?: Date;

    /** 尾款支付窗口开启时间（deposit 模式） */
    @Column({ type: 'datetime', nullable: true })
    tailStartAt?: Date;

    /** 尾款支付窗口截止时间（deposit 模式） */
    @Column({ type: 'datetime', nullable: true })
    tailEndAt?: Date;

    /** 预售价（分）；<=0 表示无价格分档，用原价 */
    @Column({ type: 'int' })
    presalePrice: number;

    /** 定金金额（分）；deposit 模式用，<=0 时落到全款语义 */
    @Column({ type: 'int' })
    depositAmount: number;

    @Column({ type: 'int' })
    totalStock: number;

    @Column({ type: 'int', default: 0 })
    soldCount: number;

    @Column({ type: 'int', default: 1 })
    limitPerUser: number;

    @Column({ type: 'int' })
    productId: number;

    @Column({ type: 'int' })
    variantId: number;

    @Column({ type: 'int' })
    channelId: number;

    @Column('varchar', { default: 'upcoming' })
    status: PreSaleStatus;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}