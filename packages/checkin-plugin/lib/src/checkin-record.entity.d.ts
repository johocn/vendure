import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class CheckinRecord extends VendureEntity {
    constructor(input?: DeepPartial<CheckinRecord>);
    channelId: number;
    customerId: number;
    /** YYYY-MM-DD（本地时区） */
    checkinDate: string;
    points: number;
    growth: number;
    /** 结算时的连续签到天数 */
    streak: number;
}
