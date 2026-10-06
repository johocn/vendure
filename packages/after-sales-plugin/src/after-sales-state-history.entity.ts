import { Column, CreateDateColumn, Entity, Index, ManyToOne } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { AfterSalesRequest } from './after-sales-request.entity';

/** 售后单状态流转历史（每次状态变更落一行，供 C 端/后台时间线显示逐节点时间） */
@Entity('after_sales_state_history')
@Index(['requestId'])
export class AfterSalesStateHistory extends VendureEntity {
    constructor(input?: DeepPartial<AfterSalesStateHistory>) {
        super(input);
    }

    @ManyToOne(() => AfterSalesRequest, (r) => r.history, { onDelete: 'CASCADE' })
    request: AfterSalesRequest;

    @Column()
    requestId: number;

    /** 来源状态（创建时无来源态为 null） */
    @Column({ type: 'varchar', nullable: true })
    fromState: string | null;

    @Column({ type: 'varchar' })
    toState: string;

    /** 操作人 User 主键（顾客侧/系统兜底路径可为 null） */
    @Column({ type: 'int', nullable: true })
    operatorUserId: number | null;

    @CreateDateColumn()
    createdAt: Date;
}
