import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 应盘行（规格 §4.3）。
 * 注意：`bookQty` 是「该变体在该仓」的账面快照，**仅供行内提示**，
 * 差异一律按变体汇总计算（R11），禁止逐行相减。
 * 唯一约束里 `binId` 可空 → postgres 中 NULL 互不相等，故「未归位桶」允许同变体多行（符合预期）。
 */
export declare class StocktakeLine extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeLine>);
    tenantChannelId: string;
    taskId: number;
    waveId: number;
    variantId: number;
    /** 快照：商品改名后仍可对账 */
    variantSku: string;
    variantName: string;
    zoneId: number | null;
    binId: number | null;
    zoneCode: string | null;
    binCode: string | null;
    bookQty: number;
    /** 实盘数；null = 未盘 */
    countedQty: number | null;
    /** 盘盈行（清单外登记的） */
    isExtra: boolean;
    countedById: string | null;
    countedByName: string | null;
    countedAt: Date | null;
    note: string | null;
}
