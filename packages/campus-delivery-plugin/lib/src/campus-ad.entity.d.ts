import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/**
 * 广告投放单（P2-3）：商家自助下单 → 模拟支付 → 平台审核 → 按日期投放。
 *
 * 计费口径：按天 × 广告位单价，下单即固化为 unitPriceFen / totalFen，
 * 之后广告位调价不影响已创建的投放单。
 */
export declare class CampusAdCampaign extends VendureEntity {
    channelId: ID;
    /** homeBanner（首页横幅）/ shopTop（店铺页顶部） */
    slot: string;
    title: string;
    imageUrl: string | null;
    linkUrl: string | null;
    /** 投放起止日（含首尾，YYYY-MM-DD） */
    startDate: string;
    endDate: string;
    days: number;
    unitPriceFen: number;
    totalFen: number;
    /** pendingPay / pendingReview / running / rejected / cancelled（已结束由日期实时判定） */
    status: string;
    payRef: string | null;
    paidAt: Date | null;
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    createdBy: string | null;
    constructor(input?: DeepPartial<CampusAdCampaign>);
}
