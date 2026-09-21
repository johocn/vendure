import { DeepPartial } from '@vendure/common/lib/shared-types';
import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index, OneToMany } from 'typeorm';

import { PickBatchOrder } from './pick-batch-order.entity';

/** 拣货批次状态。SHIPPED / CANCELLED 为终态。 */
export type PickBatchState = 'PENDING' | 'PICKED' | 'PRINTED' | 'SHIPPED' | 'CANCELLED';

@Entity('pick_batch')
export class PickBatch extends VendureEntity {
    constructor(input?: DeepPartial<PickBatch>) {
        super(input);
    }

    /** 批次号，格式 PB20260922-001（日期 + 当日 3 位序号） */
    @Index({ unique: true })
    @Column({ type: 'varchar' })
    code!: string;

    /** 归属租户渠道，用于 scoping */
    @Index()
    @Column({ type: 'varchar' })
    tenantChannelId!: string;

    /** 目标发货仓（一个批次锁一个仓） */
    @Column({ type: 'integer' })
    stockLocationId!: number;

    @Index()
    @Column({ type: 'varchar', default: 'PENDING' })
    state!: PickBatchState;

    @Column({ type: 'varchar', nullable: true })
    note!: string | null;

    /** 创建人，优先取 TenantMember.displayName */
    @Column({ type: 'varchar', nullable: true })
    createdBy!: string | null;

    @Column({ type: 'datetime', nullable: true })
    pickedAt!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    printedAt!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    shippedAt!: Date | null;

    @OneToMany(() => PickBatchOrder, (o) => o.batch)
    orders!: PickBatchOrder[];
}
