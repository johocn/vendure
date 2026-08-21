import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';
import { SubscriptionFrequency } from './types';

/** 周期购套餐档：绑定店铺，多频次 + N 期 + 每期价格 + 组合模板。 */
@Entity()
@Index(['channelId', 'shopId'], { unique: false })
export class SubscriptionPlan extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<SubscriptionPlan>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'int' })
    shopId: number;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'varchar', nullable: true })
    description?: string;

    /** 多频次：{kind:'daily'} | {kind:'weekly',dayOfWeek} | {kind:'everyNDays',interval}。simple-json 避免跨库枚举风险。 */
    @Column({ type: 'simple-json' })
    frequency: SubscriptionFrequency;

    /** 期数 N。 */
    @Column({ type: 'int' })
    periods: number;

    /** 每期价格（分）。 */
    @Column({ type: 'int' })
    periodPrice: number;

    /** 组合模板 [{variantId,quantity}]，供卖家逐期快速预设（simple-json）。 */
    @Column({ type: 'simple-json', nullable: true })
    templateItems?: Array<{ variantId: string | number; quantity: number }>;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}