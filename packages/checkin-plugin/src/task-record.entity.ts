import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
@Index(['customerId', 'taskCode', 'channelId', 'period'], { unique: true })
export class TaskRecord extends VendureEntity {
    constructor(input?: DeepPartial<TaskRecord>) {
        super(input);
    }
    @Column({ type: 'int' })
    channelId: number;
    @Column({ type: 'int' })
    customerId: number;
    @Column({ type: 'varchar' })
    taskCode: string;
    /** ACCOUNT | MILESTONE */
    @Column({ type: 'varchar' })
    type: string;
    /** DAILY | ONCE */
    @Column({ type: 'varchar' })
    repeatability: string;
    /** DAILY 任务落 YYYY-MM-DD；ONCE 任务为空 */
    @Column({ type: 'varchar', length: 10, nullable: true })
    period: string | null;
    @Column({ type: 'int' })
    points: number;
    @Column({ type: 'int' })
    growth: number;
}