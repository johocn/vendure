import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class Coupon extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Coupon>) {
        super(input);
    }

    @Column() name: string;

    @Column({ nullable: true }) description: string;

    @Column({ type: 'varchar' }) couponType: string;

    @Column({ type: 'int' }) discountValue: number;

    @Column({ type: 'int', default: 0 }) minSpend: number;

    @Column({ type: 'int', default: 0 }) maxDiscount: number;

    @Column() startAt: Date;

    @Column() endAt: Date;

    @Column({ type: 'int' }) totalQuantity: number;

    @Column({ type: 'int', default: 0 }) claimedCount: number;

    @Column({ type: 'int', default: 1 }) limitPerUser: number;

    @Column({ default: true }) isActive: boolean;

    @Column({ type: 'simple-json', nullable: true }) applicableProductIds: number[];

    @Column({ type: 'simple-json', nullable: true }) applicableCategoryIds: number[];

    @Column({ default: false }) isNewUserOnly: boolean;

    /** 全局优惠券：由超级管理员创建，所有渠道可见 */
    @Column({ default: false }) isGlobal: boolean;

    /** 优惠券所属渠道 ID（全局券为 null） */
    @Column({ type: 'int', nullable: true }) ownerChannelId: number | null;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
