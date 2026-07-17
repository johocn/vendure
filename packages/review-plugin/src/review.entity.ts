import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class Review extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Review>) {
        super(input);
    }

    @Column() customerId: number;

    @Column() productId: number;

    @Column({ type: 'int', nullable: true }) orderLineId: number | null;

    @Column({ type: 'int', nullable: true }) variantId: number | null;

    @Column({ type: 'int' }) rating: number;

    @Column({ type: 'text' }) content: string;

    @Column({ type: 'simple-json', nullable: true }) images: string[] | null;

    @Column({ type: 'simple-json', nullable: true }) videos: string[] | null;

    @Column({ type: 'simple-json', nullable: true }) tags: string[] | null;

    @Column({ default: false }) isAnonymous: boolean;

    @Column({ type: 'varchar', default: 'pending' }) status: string;

    @Column({ type: 'text', nullable: true }) reply: string | null;

    @Column({ type: 'timestamptz', nullable: true }) repliedAt: Date | null;

    @Column({ default: 0 }) helpfulCount: number;

    @ManyToOne(() => Channel) channel: Channel;

    @Column() channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
