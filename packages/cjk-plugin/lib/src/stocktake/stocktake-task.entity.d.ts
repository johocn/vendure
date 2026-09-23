import { DeepPartial, VendureEntity } from '@vendure/core';
/** 任务状态（规格 §5）：DRAFT → OPEN → COUNTING → COUNTED → POSTED，任意非终态可 CANCELLED */
export type StocktakeTaskState = 'DRAFT' | 'OPEN' | 'COUNTING' | 'COUNTED' | 'POSTED' | 'CANCELLED';
/**
 * 盘库任务：一个任务 = 一个仓库；多仓协同靠 activityCode 分组，各仓独立过账（规格 §3.3）。
 */
export declare class StocktakeTask extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeTask>);
    /** 任务号，前缀 TK（避开单据前缀 ST，防混淆） */
    code: string;
    /** 渠道收口键（硬性 R10）：写入 String(ctx.channelId)，所有查询按此过滤 */
    tenantChannelId: string;
    stockLocationId: number;
    /** 盘点活动分组码（多仓归一组），可为空 */
    activityCode: string | null;
    name: string;
    /** 圈范围条件快照（JSON 文本）：{ zones, categoryIds, variantIds, includeZeroBook } */
    scopeJson: string;
    /** 建任务时的档位（off/zone/bin）：避免中途改档导致语义漂移 */
    binModeAtCreate: string;
    state: StocktakeTaskState;
    createdById: string | null;
    createdByName: string | null;
    postedStockDocId: number | null;
    postedAt: Date | null;
    note: string | null;
}
