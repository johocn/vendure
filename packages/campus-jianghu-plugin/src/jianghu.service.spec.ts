import { describe, expect, it } from 'vitest';
import {
    RANK_LADDER,
    clampByDailyCap,
    computeRank,
    nextRank,
    rookieFactor,
    splitRewardPool,
    streakFactor,
    timeFactor,
} from './constants';
import { JianghuRiskService } from './jianghu-risk.service';

/**
 * 纯函数单测：段位计算、日上限裁剪、时段/连击/新手系数、暗号与围栏。
 * 不涉及 DB，保证核心数值口径与前端、文档三处一致。
 */
describe('jianghu constants', () => {
    it('段位门槛单调递增且九级', () => {
        expect(RANK_LADDER.length).toBe(9);
        for (let i = 1; i < RANK_LADDER.length; i++) {
            expect(RANK_LADDER[i].rep).toBeGreaterThan(RANK_LADDER[i - 1].rep);
        }
    });

    it('computeRank 落在正确区间', () => {
        expect(computeRank(0).code).toBe('L1');
        expect(computeRank(59).code).toBe('L1');
        expect(computeRank(60).code).toBe('L2');
        expect(computeRank(5999).code).toBe('L8');
        expect(computeRank(6000).code).toBe('L9');
        expect(computeRank(99999).code).toBe('L9');
    });

    it('nextRank 满级返回 null', () => {
        expect(nextRank(6000)).toBeNull();
        expect(nextRank(0)?.code).toBe('L2');
    });

    it('clampByDailyCap 不超过剩余上限', () => {
        expect(clampByDailyCap(0, 100)).toBe(100);
        expect(clampByDailyCap(250, 100, 300)).toBe(50);
        expect(clampByDailyCap(300, 100, 300)).toBe(0);
        expect(clampByDailyCap(400, 100, 300)).toBe(0);
    });

    it('系数范围正确', () => {
        expect(timeFactor(new Date('2026-10-08T12:00:00'))).toBe(1.2);
        expect(timeFactor(new Date('2026-10-08T03:00:00'))).toBe(0.8);
        expect(timeFactor(new Date('2026-10-08T09:00:00'))).toBe(1.0);
        expect(streakFactor(30)).toBe(1.2);
        expect(streakFactor(0)).toBe(1.0);
        expect(rookieFactor(3)).toBe(1.3);
        expect(rookieFactor(10)).toBe(1.0);
    });

    it('splitRewardPool 按人数均分并向下取整', () => {
        expect(splitRewardPool(200, 5)).toBe(40);
        expect(splitRewardPool(200, 3)).toBe(66);
        expect(splitRewardPool(199, 3)).toBe(66);
        expect(splitRewardPool(0, 5)).toBe(0);
        expect(splitRewardPool(null, 5)).toBe(0);
        expect(splitRewardPool(200, 0)).toBe(0);
    });
});

describe('JianghuRiskService', () => {
    const risk = new JianghuRiskService();

    it('genCode 生成 6 位数字', () => {
        const code = risk.genCode();
        expect(code).toMatch(/^\d{6}$/);
    });

    it('withinFence 半径内/外判定', () => {
        // 同一坐标 → 0 米
        expect(risk.withinFence(30.0, 114.0, 30.0, 114.0, 100)).toBe(true);
        // 约 111km 纬度差 1 度 → 远超 100m
        expect(risk.withinFence(31.0, 114.0, 30.0, 114.0, 100)).toBe(false);
        // 无目标坐标 → 放行
        expect(risk.withinFence(30.0, 114.0, 0, 0, 100)).toBe(true);
    });
});
