/**
 * 江湖体系常量与段位配置。
 * 口径来自 docs/specs/jianghu-rank-system.md（waimai 仓库文档），前后端共用同一套数值。
 */
/** 密信等级 */
export type JianghuLevel = 'NORMAL' | 'URGENT' | 'SECRET';
/** 任务方向 */
export type JianghuTaskType = 'LETTER' | 'INTEL' | 'PLOT';
/** 核销方式 */
export type JianghuVerifyMode = 'CODE' | 'QR' | 'LBS' | 'ORDER_BIND';
export type JianghuTaskStatus = 'OPEN' | 'TAKEN' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
/** 各等级基础声望 */
export declare const LEVEL_REWARD: Record<JianghuLevel, number>;
/** 传闻采纳声望 */
export declare const RUMOR_REWARD = 8;
/** 情报集市解锁价（积分） */
export declare const INTEL_PRICE = 5;
/** 情报解锁作者分成（声望） */
export declare const INTEL_SALE_REWARD = 3;
/** 声望日上限 / 周上限（防刷） */
export declare const REP_DAILY_CAP = 300;
export declare const REP_WEEKLY_CAP = 1200;
/** 接取后锁定时长：15 分钟 */
export declare const TAKE_LOCK_MS: number;
/** 暗号有效期：60 秒 */
export declare const CODE_TTL_MS: number;
/** 单任务暗号试错上限 */
export declare const VERIFY_TRY_LIMIT = 3;
/** LBS 围栏半径（米） */
export declare const LBS_FENCE_M = 100;
/** 同一对（传信者 ↔ 收信人）每日核销上限 */
export declare const DAILY_PAIR_LIMIT = 2;
/** 信用分下限：低于此值冻结江湖任务 */
export declare const CREDIT_LIMIT = 60;
/** 时段系数：高峰 1.2 / 平峰 1.0 / 夜间 0.8 */
export declare function timeFactor(at?: Date): number;
/** 连击系数：连续活跃 3/7/14/30 天，上限 1.20 */
export declare function streakFactor(streakDays: number): number;
/** 新手加成：入江湖前 7 天 ×1.3 */
export declare function rookieFactor(daysSinceJoin: number): number;
export interface RankTierConfig {
    code: string;
    name: string;
    rep: number;
    realm: string;
    seal: string;
    conditionText: string;
    perksVirtual: string[];
    perksReal: string[];
}
/** 九级段位：三境九级，运营可在后台调整（JianghuRankConfig 化后可持久化，当前常量） */
export declare const RANK_LADDER: RankTierConfig[];
/** 声望 → 所处段位（纯函数，便于单测） */
export declare function computeRank(rep: number): RankTierConfig;
/** 声望 → 下一段位；已满级返回 null */
export declare function nextRank(rep: number): RankTierConfig | null;
/** 日上限裁剪（纯函数）：返回实际可入账声望 */
export declare function clampByDailyCap(repToday: number, delta: number, cap?: number): number;
/** 破案奖励池按去重贡献者人数均分（纯函数，向下取整；便于单测与前端复用） */
export declare function splitRewardPool(pool: number | null | undefined, contributorCount: number): number;
