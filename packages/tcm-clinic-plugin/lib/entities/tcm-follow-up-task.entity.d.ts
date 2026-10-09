import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmFollowUpTask extends VendureEntity {
    constructor(input?: DeepPartial<TcmFollowUpTask>);
    patientProfileId: number;
    /** 关联康养规划（spec：planId/patientId 二选一，可空） */
    planId?: number;
    title: string;
    dueAt: Date;
    /** wechat | sms | phone */
    channel: string;
    /** PENDING | DONE | CANCELED */
    status: string;
    /** 结果回写的接诊（不建外键） */
    followUpEncounterId?: number;
}
