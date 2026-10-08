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
export const LEVEL_REWARD: Record<JianghuLevel, number> = {
    NORMAL: 10,
    URGENT: 25,
    SECRET: 60
};

/** 传闻采纳声望 */
export const RUMOR_REWARD = 8;
/** 情报集市解锁价（积分） */
export const INTEL_PRICE = 5;
/** 情报解锁作者分成（声望） */
export const INTEL_SALE_REWARD = 3;

/** 声望日上限 / 周上限（防刷） */
export const REP_DAILY_CAP = 300;
export const REP_WEEKLY_CAP = 1200;

/** 接取后锁定时长：15 分钟 */
export const TAKE_LOCK_MS = 15 * 60 * 1000;
/** 暗号有效期：60 秒 */
export const CODE_TTL_MS = 60 * 1000;
/** 单任务暗号试错上限 */
export const VERIFY_TRY_LIMIT = 3;
/** LBS 围栏半径（米） */
export const LBS_FENCE_M = 100;
/** 同一对（传信者 ↔ 收信人）每日核销上限 */
export const DAILY_PAIR_LIMIT = 2;
/** 信用分下限：低于此值冻结江湖任务 */
export const CREDIT_LIMIT = 60;

/** 时段系数：高峰 1.2 / 平峰 1.0 / 夜间 0.8 */
export function timeFactor(at: Date = new Date()): number {
    const h = at.getHours();
    if ((h >= 11 && h < 13) || (h >= 17 && h < 19)) return 1.2;
    if (h >= 23 || h < 6) return 0.8;
    return 1.0;
}

/** 连击系数：连续活跃 3/7/14/30 天，上限 1.20 */
export function streakFactor(streakDays: number): number {
    if (streakDays >= 30) return 1.2;
    if (streakDays >= 14) return 1.15;
    if (streakDays >= 7) return 1.1;
    if (streakDays >= 3) return 1.05;
    return 1.0;
}

/** 新手加成：入江湖前 7 天 ×1.3 */
export function rookieFactor(daysSinceJoin: number): number {
    return daysSinceJoin < 7 ? 1.3 : 1.0;
}

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
export const RANK_LADDER: RankTierConfig[] = [
    { code: 'L1', name: '布衣闲人', rep: 0, realm: '行脚境', seal: '布', conditionText: '领取第一封密信', perksVirtual: ['江湖名号可见'], perksReal: [] },
    { code: 'L2', name: '见习传信者', rep: 60, realm: '行脚境', seal: '见', conditionText: '骑手入驻通过 + 信用分 ≥60 + 完成 3 单真实订单', perksVirtual: ['江湖名号自定义一次', '素墨头像框'], perksReal: [] },
    { code: 'L3', name: '青羽信童', rep: 180, realm: '行脚境', seal: '青', conditionText: '密信累计 10 封 + 传闻采纳 5 条 + 信用分 ≥70', perksVirtual: ['可接普通信全量', '传闻不限分类', '青羽头像框'], perksReal: ['接单范围 +1 栋楼'] },
    { code: 'L4', name: '墨羽信使', rep: 420, realm: '信使境', seal: '墨', conditionText: '加急密函 5 封 + 绝密卷宗 1 封 + 入江湖满 7 天', perksVirtual: ['可接加急密函', '密语可选密文体'], perksReal: ['高峰期优先派单 ×1.2'] },
    { code: 'L5', name: '疾影信使', rep: 900, realm: '信使境', seal: '疾', conditionText: '带教 1 名新人至 L2 + 连续 2 周每周活跃 ≥3 天', perksVirtual: ['可发江湖召集令', '师徒系统开启'], perksReal: ['提现手续费 5 折'] },
    { code: 'L6', name: '飞鸿驿丞', rep: 1600, realm: '信使境', seal: '鸿', conditionText: '情报值 ≥300 + 完成 1 次江湖事件', perksVirtual: ['解锁情报阁', '可发布悬赏', '可看集市热门'], perksReal: ['提现免手续费', '免押金领装备'] },
    { code: 'L7', name: '包打听', rep: 2600, realm: '百晓境', seal: '听', conditionText: '情报值 ≥800 + 集市上架被采纳 10 条', perksVirtual: ['可看绝密条目', '可发起江湖事件', '包打听身份标识'], perksReal: ['优先派单 ×1.5', '可接跨校区订单'] },
    { code: 'L8', name: '万事通', rep: 4000, realm: '百晓境', seal: '通', conditionText: '组队完成 1 次江湖大案 + 解锁剧情 ≥3 章', perksVirtual: ['可建传信者联盟', '自定义队徽', '剧情皮肤'], perksReal: ['专属客服通道', '提现 T+0'] },
    { code: 'L9', name: '百晓生', rep: 6000, realm: '百晓境', seal: '晓', conditionText: '密信累计 200 封 + 3 名 L7 举荐 + 零严重违规 + 校区学期限量 20 人', perksVirtual: ['百晓生金印框', '首页推荐位', '内容共创资格'], perksReal: ['平台激励返点 +1%'] }
];

/** 声望 → 所处段位（纯函数，便于单测） */
export function computeRank(rep: number): RankTierConfig {
    return RANK_LADDER.reduce<RankTierConfig>((acc, t) => (rep >= t.rep ? t : acc), RANK_LADDER[0]);
}

/** 声望 → 下一段位；已满级返回 null */
export function nextRank(rep: number): RankTierConfig | null {
    return RANK_LADDER.find((t) => t.rep > rep) ?? null;
}

/** 日上限裁剪（纯函数）：返回实际可入账声望 */
export function clampByDailyCap(repToday: number, delta: number, cap = REP_DAILY_CAP): number {
    const left = Math.max(0, cap - repToday);
    return Math.max(0, Math.min(delta, left));
}

/** 破案奖励池按去重贡献者人数均分（纯函数，向下取整；便于单测与前端复用） */
export function splitRewardPool(pool: number | null | undefined, contributorCount: number): number {
    if (!pool || contributorCount <= 0) return 0;
    return Math.floor(pool / contributorCount);
}
