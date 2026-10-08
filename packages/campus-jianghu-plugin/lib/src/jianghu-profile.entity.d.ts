import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 江湖传信者档案：1:1 挂 Customer。
 * 段位/声望/结构性晋升计数/日上限均落在此表；声望变动通过 JianghuRecord 留痕。
 */
export declare class JianghuProfile extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuProfile>);
    customerId: number;
    nickname: string;
    /** 江湖声望：只增不减（违规处罚除外） */
    rep: number;
    /** 情报值（方向二） */
    intel: number;
    /** 当前段位编码 L1..L9 */
    rankCode: string;
    /** 骑手信用分镜像：<60 冻结江湖任务 */
    credit: number;
    letterDone: number;
    intelDone: number;
    plotDone: number;
    urgentDone: number;
    secretDone: number;
    repToday: number;
    repDailyCap: number;
    /** 日界限 'YYYY-MM-DD'，跨天重置 repToday */
    repDay: string | null;
    streakDays: number;
    lastActiveDay: string | null;
    /** 段位保护期（ISO） */
    protectedUntil: string | null;
    /** 面壁结束时间（ISO）；非空即冻结 */
    frozenUntil: string | null;
    violateCount: number;
    campusCode: string | null;
    customer?: Customer;
    channel?: Channel;
}
