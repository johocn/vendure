import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
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

    @Column({ nullable: true }) repliedAt?: Date;

    @Column({ default: 0 }) helpfulCount: number;

    @Column({ type: 'int' }) channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    /** 自关联：追评。parentId 为主评 id，NULL 表示主评。聚合只统计 parentId==NULL 的主评。 */
    @Column({ type: 'int', nullable: true })
    parentId: number | null;

    /** 评价有礼：主评审核通过时已发放奖励（券/积分任一），幂等闸。 */
    @Column({ default: false })
    giftGranted: boolean;

    /** 审核时间（approve/reject 留痕）；追评窗口以此为基准。 */
    @Column({ type: 'timestamp', nullable: true })
    reviewedAt?: Date | null;
}
