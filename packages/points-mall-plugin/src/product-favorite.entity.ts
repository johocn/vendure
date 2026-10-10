import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, CreateDateColumn, Entity, Index, Unique } from 'typeorm';

/** 商品收藏行（同 productId+customerId 唯一） */
@Entity()
@Unique(['productId', 'customerId'])
@Index(['customerId', 'channelId'])
export class ProductFavorite extends VendureEntity {
    constructor(input?: DeepPartial<ProductFavorite>) {
        super(input);
    }

    @Column()
    productId: number;

    @Column()
    customerId: number;

    @Column()
    channelId: number;

    @CreateDateColumn()
    favoritedAt: Date;
}
