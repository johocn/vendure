import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Unique } from 'typeorm';

/** 点赞行（同 postId+customerId 唯一：存在即已赞，删除即取消） */
@Entity()
@Unique(['postId', 'customerId'])
export class CircleLike extends VendureEntity {
    constructor(input?: DeepPartial<CircleLike>) {
        super(input);
    }

    @Column()
    postId: number;

    @Column()
    customerId: number;

    @Column()
    channelId: number;
}
