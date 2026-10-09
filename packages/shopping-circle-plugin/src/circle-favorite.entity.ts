import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Unique } from 'typeorm';

/** 收藏行（与 CircleLike 同构：同 postId+customerId 唯一） */
@Entity()
@Unique(['postId', 'customerId'])
export class CircleFavorite extends VendureEntity {
    constructor(input?: DeepPartial<CircleFavorite>) {
        super(input);
    }

    @Column()
    postId: number;

    @Column()
    customerId: number;

    @Column()
    channelId: number;
}
