import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class Feedback extends VendureEntity {
    constructor(input?: DeepPartial<Feedback>) {
        super(input);
    }

    @Column({ type: 'int' })
    customerId: number;

    /** 功能异常/体验问题/其他 */
    @Column({ type: 'varchar', default: 'other' })
    type: string;

    /** ≤20 字（对齐 usemall） */
    @Column({ type: 'varchar', length: 20 })
    title: string;

    @Column({ type: 'text' })
    content: string;

    /** JSON 字符串数组（uploadCustomerAsset 的 source 列表） */
    @Column({ type: 'text', nullable: true })
    imgs: string | null;

    /** ≤30 字 */
    @Column({ type: 'varchar', length: 30, nullable: true })
    contactWay: string | null;

    @Column({ type: 'varchar', default: 'pending' })
    status: 'pending' | 'processing' | 'resolved';

    /** 日期列省略 type（2026-10-08 教训：显式 datetime/timestamp 在 sqljs 下报 DataTypeNotSupportedError） */
    @Column({ nullable: true })
    handledAt: Date;

    /** 管理员回复（回复即闭环；C 端 myFeedbacks 透出） */
    @Column({ type: 'text', nullable: true })
    reply: string | null;

    /** 日期列省略 type（sqljs 兼容，同 handledAt） */
    @Column({ nullable: true })
    repliedAt: Date;

    @Column({ type: 'varchar', nullable: true })
    repliedBy: string | null;

    /** 用户已读标记：未读 = readAt IS NULL AND status != 'pending'（联合类型需显式 datetime，否则反射为 Object 且 sqljs 不认） */
    @Column({ type: 'datetime', nullable: true })
    readAt: Date | null;
}
