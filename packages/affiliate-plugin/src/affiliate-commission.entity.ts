import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

export type CommissionStatus = 'pending' | 'paid' | 'reversed';
export type LoadOn = 'merchant' | 'platform';

@Entity()
@Index(['orderId', 'orderLineId'], { unique: true })
export class AffiliateCommissionEntry extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<AffiliateCommissionEntry>) {
        super(input);
    }

    @Index()
    @Column()
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column({ type: 'int' })
    affiliateId: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'int' })
    orderId: number;

    @Column({ type: 'int' })
    orderLineId: number;

    @Column({ type: 'int' })
    shopId: number;

    /** 成交额，分。 */
    @Column({ type: 'bigint' })
    baseAmount: number;

    /** 千分比。 */
    @Column({ type: 'int' })
    rate: number;

    /** 佣金，分。 */
    @Column({ type: 'bigint' })
    commissionAmount: number;

    @Column({ type: 'varchar', default: 'merchant' })
    loadOn: LoadOn;

    @Column({ type: 'varchar', default: 'pending' })
    status: CommissionStatus;

    @Index()
    @Column({ type: 'int', nullable: true })
    withdrawalId?: number | null;
}