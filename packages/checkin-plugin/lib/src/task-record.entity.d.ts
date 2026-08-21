import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TaskRecord extends VendureEntity {
    constructor(input?: DeepPartial<TaskRecord>);
    channelId: number;
    customerId: number;
    taskCode: string;
    /** ACCOUNT | MILESTONE */
    type: string;
    /** DAILY | ONCE */
    repeatability: string;
    /** DAILY 任务落 YYYY-MM-DD；ONCE 任务为空 */
    period: string | null;
    points: number;
    growth: number;
}
