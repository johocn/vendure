import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class LotteryPrize extends VendureEntity {
    constructor(input?: DeepPartial<LotteryPrize>) {
        super(input);
    }

    /** 奖项名（如「谢谢参与」） */
    @Column({ type: 'varchar' })
    name: string;

    /** 奖品图 URL */
    @Column({ type: 'varchar', nullable: true })
    image: string | null;

    /** 中奖权重（相对值；<=0 不参与开奖，但仍展示在九宫格） */
    @Column({ type: 'int', default: 0 })
    weight: number;

    /** 每次抽中该奖项消耗的积分（不是分） */
    @Column({ type: 'int', default: 0 })
    consume: number;

    /** 剩余库存；null = 不限量。库存为 0 的奖品不参与开奖 */
    @Column({ type: 'int', nullable: true })
    stock: number | null;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @Column({ type: 'int', default: 0 })
    sort: number;

    /** null = 全渠道通用 */
    @Column({ type: 'int', nullable: true })
    channelId: number | null;
}
