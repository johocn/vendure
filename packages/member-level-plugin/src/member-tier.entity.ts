import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
@Index(['tierLevel', 'channelId'], { unique: true })
export class MemberTier extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<MemberTier>) {
        super(input);
    }

    @Column({ type: 'int' }) tierLevel: number;

    @Column({ type: 'int' }) threshold: number;

    @Column({ type: 'varchar' }) name: string;

    /** 积分获取倍率（千分比，150 = 1.5 倍）。 */
    @Column({ type: 'int', default: 1000 }) pointsMultiplier: number;

    /** 抵现折扣率（千分比，1000 = 1 分抵 1 分）。率越高每分抵得越多。 */
    @Column({ type: 'int', default: 1000 }) redeemDiscountRate: number;

    /** 可抵占订单金额上限比例（千分比，500 = 最多抵 50%）。 */
    @Column({ type: 'int', default: 500 }) redeemCapRatio: number;

    /** 等级专属折扣率（千分比，0 = 无专属折扣）。 */
    @Column({ type: 'int', default: 0 }) specialDiscountRate: number;

    @Column({ type: 'int' }) channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}