import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class FlashSaleActivity extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<FlashSaleActivity>) {
        super(input);
    }

    @Column() name: string;

    @Column() startAt: Date;

    @Column() endAt: Date;

    @Column() flashPrice: number;

    @Column() totalStock: number;

    @Column({ default: 0 }) soldCount: number;

    @Column({ default: 1 }) limitPerUser: number;

    @Column() productId: number;

    @Column() variantId: number;

    @Column({ default: 'upcoming' }) status: 'upcoming' | 'active' | 'ended';

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
