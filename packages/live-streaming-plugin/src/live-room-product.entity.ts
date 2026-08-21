import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class LiveRoomProduct extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<LiveRoomProduct>) {
        super(input);
    }

    /** 商品 variantId */
    @Column()
    variantId: string;

    /** 商品标题（冗余展示） */
    @Column()
    name: string;

    /** 售价（分） */
    @Column()
    price: number;

    /** 商品图 */
    @Column({ type: 'varchar', nullable: true })
    imageUrl: string | null;

    /** 排序（越小越靠前） */
    @Column({ default: 0 })
    sortOrder: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
