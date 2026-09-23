import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * 盘次状态（规格 §4.2/§5）。
 * 说明：规格 §4.2 的枚举里含 `RELEASED`，本实现**不落库该状态** —— 「释放」语义 =
 * 回到 `OPEN` 且清空 assigneeId（可再次被认领），用状态 + 负责人两个字段即可表达，
 * 不额外增加一个瞬时状态（详见末节「自审记录」的类型一致性核对）。
 */
export type StocktakeWaveState = 'OPEN' | 'CLAIMED' | 'COUNTING' | 'SUBMITTED' | 'CANCELLED';
/** 盘次范围类型：zone=按库区 / whole=off 档整仓 / unassigned=未归位桶 */
export type StocktakeScopeType = 'zone' | 'whole' | 'unassigned';
/**
 * 盘次：同一时刻只有一个负责人（独占锁），可指派也可开放认领（规格 §3.6）。
 */
export declare class StocktakeWave extends VendureEntity {
    constructor(input?: DeepPartial<StocktakeWave>);
    tenantChannelId: string;
    taskId: number;
    scopeType: StocktakeScopeType;
    zoneId: number | null;
    /** 冗余快照：库区改名后仍可对账 */
    zoneCode: string | null;
    zoneName: string | null;
    /** TenantMember.id；null = 待认领 */
    assigneeId: string | null;
    assigneeName: string | null;
    state: StocktakeWaveState;
    /** 快照：应盘项数（进度分母） */
    expectedCount: number;
    /** 已盘项数（冗余加速） */
    countedCount: number;
    claimedAt: Date | null;
    submittedAt: Date | null;
}
