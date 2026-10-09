import { Channel, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity()
export class CirclePost extends VendureEntity {
    constructor(input?: DeepPartial<CirclePost>) {
        super(input);
    }

    @Column()
    customerId: number;

    /** ≤50 字（对齐 usemall note.vue） */
    @Column({ type: 'varchar', length: 50, nullable: true })
    title: string | null;

    @Column({ type: 'text' })
    content: string;

    /** JSON 字符串数组（uploadCustomerAsset 的 source 列表） */
    @Column({ type: 'text', nullable: true })
    images: string | null;

    @Column({ type: 'varchar', nullable: true })
    videoUrl: string | null;

    /** 「买同款」跳转的商品 id */
    @Column({ type: 'varchar', nullable: true })
    productId: string | null;

    @Column({ type: 'int', default: 0 })
    likeCount: number;

    @Column({ type: 'int', default: 0 })
    favoriteCount: number;

    @Column({ type: 'varchar', default: 'published' })
    status: 'published' | 'hidden';

    @Column({ type: 'boolean', default: false })
    isPinned: boolean;

    @ManyToOne(() => Channel)
    channel: Channel;

    @Column()
    channelId: number;
}
