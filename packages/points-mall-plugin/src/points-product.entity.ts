import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/** 积分商品：引用 core 商品/变体 + 兑换配置（积分价按变体生效，同秒杀价口径） */
@Entity()
@Index(['channelId', 'status'])
export class PointsProduct extends VendureEntity {
    constructor(input?: DeepPartial<PointsProduct>) {
        super(input);
    }

    @Column()
    productId: number;

    @Column()
    variantId: number;

    @Column({ type: 'int' })
    pointsPrice: number; // 每件消耗积分

    @Column({ type: 'int', default: 0 })
    cashPrice: number; // 每件现金价（分）；0=纯积分

    /** physical=实物(需地址/发货) virtual=虚拟(直兑到账) */
    @Column({ default: 'physical' })
    deliveryType: string;

    @Column({ type: 'int', default: 0 })
    stock: number;

    @Column({ type: 'int', default: 0 })
    perUserLimit: number; // 0=不限

    @Column({ type: 'int', default: 0 })
    redeemedCount: number;

    @Column({ type: Date, nullable: true })
    validFrom: Date | null;

    @Column({ type: Date, nullable: true })
    validTo: Date | null; // 虚拟商品兼作核销有效期

    @Column({ default: 'enabled' })
    status: string; // enabled/disabled

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @Column()
    channelId: number;
}
