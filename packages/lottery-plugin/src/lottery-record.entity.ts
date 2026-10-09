import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class LotteryRecord extends VendureEntity {
    constructor(input?: DeepPartial<LotteryRecord>) {
        super(input);
    }

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'int' })
    prizeId: number;

    /** 开奖时刻的奖品快照 */
    @Column({ type: 'varchar' })
    prizeName: string;

    @Column({ type: 'varchar', nullable: true })
    prizeImage: string | null;

    /** 本次抽奖消耗的积分（不是分） */
    @Column({ type: 'int' })
    consume: number;

    @Column({ type: 'int' })
    channelId: number;

    /** 日期列省略 type（2026-10-08 教训：显式 datetime 在 sqljs 下报 DataTypeNotSupportedError） */
    @Column({ nullable: true })
    createdAt: Date;
}
