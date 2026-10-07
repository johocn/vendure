import { Column, CreateDateColumn, Entity, Index, ManyToOne, UpdateDateColumn } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { AfterSalesRequest } from './after-sales-request.entity';

/** 留言发送方类型：customer=顾客 / admin=商家管理员 */
export type AfterSalesMessageSenderType = 'customer' | 'admin';

/** 售后协商留言（顾客与商家在售后单内的双向沟通记录，Closed 后禁言） */
@Entity('after_sales_message')
@Index(['requestId'])
export class AfterSalesMessage extends VendureEntity {
    constructor(input?: DeepPartial<AfterSalesMessage>) {
        super(input);
    }

    @ManyToOne(() => AfterSalesRequest, { onDelete: 'CASCADE' })
    request: AfterSalesRequest;

    @Column()
    requestId: number;

    @Column({ type: 'varchar', default: 'customer' })
    senderType: AfterSalesMessageSenderType;

    /** 发送人 User 主键（系统路径可为 null） */
    @Column({ type: 'int', nullable: true })
    senderUserId: number | null;

    /** 发送人显示名（顾客=Customer 姓名拼接 / 管理员=Administrator 姓名拼接） */
    @Column({ type: 'varchar' })
    senderName: string;

    /** 留言正文（≤1000 字，service 层校验） */
    @Column({ type: 'text' })
    content: string;

    /** 留言图片 URL（≤3 张，复用 uploadAfterSalesEvidence 返回的绝对 URL） */
    @Column('simple-json', { nullable: true })
    images: string[] | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
