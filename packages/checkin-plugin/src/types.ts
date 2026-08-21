import { ID } from '@vendure/core';

/** 各奖励默认值图层（channel 自定义字段未配置时的兜底）。 */
export interface CheckinRewardDefaults {
    checkinPoints: number;
    checkinGrowth: number;
    checkinStreakThreshold: number;
    checkinStreakBonusPoints: number;
    checkinStreakBonusGrowth: number;
    taskSharePoints: number;
    taskShareGrowth: number;
    taskLoginPoints: number;
    taskLoginGrowth: number;
    taskProfilePoints: number;
    taskProfileGrowth: number;
    taskBindPhonePoints: number;
    taskBindPhoneGrowth: number;
    taskReachLevelThreshold: number;
    taskReachLevelPoints: number;
    taskReachLevelGrowth: number;
    taskFirstOrderPoints: number;
    taskFirstOrderGrowth: number;
    taskOrderCountThreshold: number;
    taskOrderCountPoints: number;
    taskOrderCountGrowth: number;
    taskOrderAmountThreshold: number;
    taskOrderAmountPoints: number;
    taskOrderAmountGrowth: number;
}

export interface CheckinPluginOptions {
    /** 各奖励默认值（channel 自定义字段缺省兜底）。 */
    defaultRewards?: Partial<CheckinRewardDefaults>;
}

export interface CreditResult {
    success: boolean;
    reason?: string;
    points?: number;
    growth?: number;
    streak?: number;
}

export interface TaskSummary {
    taskCode: string;
    state: string;
    points: number;
    growth: number;
}

export interface CheckinTodayInfo {
    checkedIn: boolean;
    streak: number;
    canCheckin: boolean;
}