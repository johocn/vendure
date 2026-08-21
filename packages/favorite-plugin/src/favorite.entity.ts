import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

/**
 * 收藏/关注记录。
 * - 收藏商品：productId 非空；关注店铺：shopId 非空（二者其一）。
 * - 复合唯一约束使同一顾客对同一商品/店铺天然幂等（toggle 语义）。
 * - createdAt/updatedAt 由 VendureEntity 基类提供。
 */
@Entity()
@Index(['customerId', 'productId'], { unique: true })
@Index(['customerId', 'shopId'], { unique: true })
export class Favorite extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Favorite>) {
        super(input);
    }

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'int', nullable: true })
    productId: number | null;

    @Column({ type: 'int', nullable: true })
    shopId: number | null;

    @Column({ type: 'int' })
    channelId: number;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}