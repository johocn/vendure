import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 声望/情报流水。幂等键 (customerId + reason + taskId + channelId) 唯一索引，
 * 防止核销/审核重放导致重复入账（事务内唯一冲突即视为已处理）。
 */
@Entity('jianghu_record')
@Index(['customerId'])
@Index(['idempotentKey'], { unique: true })
export class JianghuRecord extends VendureEntity {
    [key: string]: any;

    constructor(input?: DeepPartial<JianghuRecord>) {
        super(input);
    }

    @Column('int')
    customerId: number;
    @Column({ type: 'varchar', nullable: true })
    taskId: string | null;
    /** 幂等键 */
    @Column({ type: 'varchar' })
    idempotentKey: string;
    @Column({ type: 'varchar' })
    reason: string;
    @Column({ type: 'varchar', nullable: true })
    reasonText: string | null;
    @Column('int', { default: 0 })
    deltaRep: number;
    @Column('int', { nullable: true })
    deltaIntel: number | null;
    @Column('int', { nullable: true })
    snapshotRep: number | null;
    @Column({ type: 'varchar', nullable: true })
    channelId: string | null;
}
