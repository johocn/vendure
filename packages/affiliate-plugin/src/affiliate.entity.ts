import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

export type AffiliateStatus = 'active' | 'suspended';

@Entity()
export class Affiliate extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Affiliate>) {
        super(input);
    }

    @Index()
    @Column()
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    /** 推广员登录 User。 */
    @Index({ unique: true })
    @Column({ type: 'int' })
    userId: number;

    /** 空 = 全局推广。 */
    @Column({ type: 'int', nullable: true })
    shopId?: number | null;

    /** 推广码，唯一防碰撞。 */
    @Index({ unique: true })
    @Column({ type: 'varchar' })
    code: string;

    @Column({ type: 'varchar', default: 'active' })
    status: AffiliateStatus;

    /** 累计佣金，分。 */
    @Column({ type: 'bigint', default: 0 })
    totalCommission: number;

    /** 可提现余额，分。 */
    @Column({ type: 'bigint', default: 0 })
    withdrawableCommission: number;
}