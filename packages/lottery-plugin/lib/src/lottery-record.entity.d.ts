import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class LotteryRecord extends VendureEntity {
    constructor(input?: DeepPartial<LotteryRecord>);
    customerId: number;
    prizeId: number;
    /** 开奖时刻的奖品快照 */
    prizeName: string;
    prizeImage: string | null;
    /** 本次抽奖消耗的积分（不是分） */
    consume: number;
    channelId: number;
    /** 日期列省略 type（2026-10-08 教训：显式 datetime 在 sqljs 下报 DataTypeNotSupportedError） */
    createdAt: Date;
}
