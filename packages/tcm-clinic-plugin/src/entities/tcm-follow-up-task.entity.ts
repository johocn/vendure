import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_follow_up_task' })
@Index(['status', 'dueAt'])
export class TcmFollowUpTask extends VendureEntity {
    constructor(input?: DeepPartial<TcmFollowUpTask>) {
        super(input);
    }
    @Column({ type: 'int' })
    patientProfileId: number;
    @Column({ type: 'int' })
    planId?: number;
    @Column({ type: 'varchar', length: 255 })
    title: string;
    @Column({ type: 'datetime' })
    dueAt: Date;
    /** wechat | sms | phone */
    @Column({ type: 'varchar', length: 16, default: 'wechat' })
    channel: string;
    /** PENDING | DONE | CANCELED */
    @Column({ type: 'varchar', length: 16, default: 'PENDING' })
    status: string;
    /** 结果回写的接诊（不建外键） */
    @Column({ type: 'int', nullable: true })
    followUpEncounterId?: number;
}
