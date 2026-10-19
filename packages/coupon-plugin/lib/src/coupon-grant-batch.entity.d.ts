import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 沉睡召回批量发放批次（FR-E1）：结果可查询的留痕实体。
 * 每执行一次 couponWinBackGrant 落一条，resultsJson 保存逐人明细（customerId/ok/code/reason）。
 */
export declare class CouponGrantBatch extends VendureEntity {
    constructor(input?: DeepPartial<CouponGrantBatch>);
    /** 渠道（租户）id */
    channelId: number;
    /** 奖励券模板 id */
    templateId: number;
    /** 圈人参数：N 天未消费 */
    days: number;
    /** 圈中人数 */
    totalSelected: number;
    /** 发放成功人数 */
    issuedCount: number;
    /** 拦截/失败人数 */
    skippedCount: number;
    /** 逐人结果明细 JSON */
    resultsJson?: string | null;
    /** 操作人（Administrator 标识，空=系统） */
    operator?: string | null;
    /** 本批次是否已触达通知 */
    notified: boolean;
}
