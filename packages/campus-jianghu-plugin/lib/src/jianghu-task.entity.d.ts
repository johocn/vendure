import { Channel, Customer, DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 江湖任务（三方向共用主表，type 区分 LETTER / INTEL / PLOT）。
 * OPEN → TAKEN → SUBMITTED → VERIFIED / REJECTED，超时回 OPEN 或 EXPIRED。
 */
export declare class JianghuTask extends VendureEntity {
    [key: string]: any;
    constructor(input?: DeepPartial<JianghuTask>);
    type: 'LETTER' | 'INTEL' | 'PLOT';
    level: 'NORMAL' | 'URGENT' | 'SECRET';
    title: string;
    /** 列表态展示的密文/摘要 */
    brief: string | null;
    /** 密语明文：仅 TAKEN 后服务端下发 */
    plainText: string | null;
    campusCode: string | null;
    buildingCode: string | null;
    /** 收信人 NPC：只存打码代号，不暴露真实身份 */
    targetCustomerId: number | null;
    targetNick: string | null;
    targetBuilding: string | null;
    rewardRep: number;
    rewardIntel: number | null;
    verifyMode: 'CODE' | 'QR' | 'LBS' | 'ORDER_BIND';
    /** 虚实联动：绑定的真实订单 */
    boundOrderId: string | null;
    status: 'OPEN' | 'TAKEN' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
    takenByCustomerId: number | null;
    takenAt: string | null;
    expireAt: string | null;
    /** 一次性 6 位暗号（60s 有效） */
    verifyCode: string | null;
    codeExpireAt: string | null;
    /** 试错计数，上限 3 */
    tryCount: number;
    /** LBS 围栏坐标 */
    lat: number | null;
    lng: number | null;
    channelId: string | null;
    takenBy?: Customer;
    target?: Customer;
    channel?: Channel;
}
