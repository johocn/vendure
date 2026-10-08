"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const constants_1 = require("./constants");
const jianghu_risk_service_1 = require("./jianghu-risk.service");
/**
 * 纯函数单测：段位计算、日上限裁剪、时段/连击/新手系数、暗号与围栏。
 * 不涉及 DB，保证核心数值口径与前端、文档三处一致。
 */
(0, vitest_1.describe)('jianghu constants', () => {
    (0, vitest_1.it)('段位门槛单调递增且九级', () => {
        (0, vitest_1.expect)(constants_1.RANK_LADDER.length).toBe(9);
        for (let i = 1; i < constants_1.RANK_LADDER.length; i++) {
            (0, vitest_1.expect)(constants_1.RANK_LADDER[i].rep).toBeGreaterThan(constants_1.RANK_LADDER[i - 1].rep);
        }
    });
    (0, vitest_1.it)('computeRank 落在正确区间', () => {
        (0, vitest_1.expect)((0, constants_1.computeRank)(0).code).toBe('L1');
        (0, vitest_1.expect)((0, constants_1.computeRank)(59).code).toBe('L1');
        (0, vitest_1.expect)((0, constants_1.computeRank)(60).code).toBe('L2');
        (0, vitest_1.expect)((0, constants_1.computeRank)(5999).code).toBe('L8');
        (0, vitest_1.expect)((0, constants_1.computeRank)(6000).code).toBe('L9');
        (0, vitest_1.expect)((0, constants_1.computeRank)(99999).code).toBe('L9');
    });
    (0, vitest_1.it)('nextRank 满级返回 null', () => {
        var _a;
        (0, vitest_1.expect)((0, constants_1.nextRank)(6000)).toBeNull();
        (0, vitest_1.expect)((_a = (0, constants_1.nextRank)(0)) === null || _a === void 0 ? void 0 : _a.code).toBe('L2');
    });
    (0, vitest_1.it)('clampByDailyCap 不超过剩余上限', () => {
        (0, vitest_1.expect)((0, constants_1.clampByDailyCap)(0, 100)).toBe(100);
        (0, vitest_1.expect)((0, constants_1.clampByDailyCap)(250, 100, 300)).toBe(50);
        (0, vitest_1.expect)((0, constants_1.clampByDailyCap)(300, 100, 300)).toBe(0);
        (0, vitest_1.expect)((0, constants_1.clampByDailyCap)(400, 100, 300)).toBe(0);
    });
    (0, vitest_1.it)('系数范围正确', () => {
        (0, vitest_1.expect)((0, constants_1.timeFactor)(new Date('2026-10-08T12:00:00'))).toBe(1.2);
        (0, vitest_1.expect)((0, constants_1.timeFactor)(new Date('2026-10-08T03:00:00'))).toBe(0.8);
        (0, vitest_1.expect)((0, constants_1.timeFactor)(new Date('2026-10-08T09:00:00'))).toBe(1.0);
        (0, vitest_1.expect)((0, constants_1.streakFactor)(30)).toBe(1.2);
        (0, vitest_1.expect)((0, constants_1.streakFactor)(0)).toBe(1.0);
        (0, vitest_1.expect)((0, constants_1.rookieFactor)(3)).toBe(1.3);
        (0, vitest_1.expect)((0, constants_1.rookieFactor)(10)).toBe(1.0);
    });
    (0, vitest_1.it)('splitRewardPool 按人数均分并向下取整', () => {
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(200, 5)).toBe(40);
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(200, 3)).toBe(66);
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(199, 3)).toBe(66);
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(0, 5)).toBe(0);
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(null, 5)).toBe(0);
        (0, vitest_1.expect)((0, constants_1.splitRewardPool)(200, 0)).toBe(0);
    });
});
(0, vitest_1.describe)('JianghuRiskService', () => {
    const risk = new jianghu_risk_service_1.JianghuRiskService();
    (0, vitest_1.it)('genCode 生成 6 位数字', () => {
        const code = risk.genCode();
        (0, vitest_1.expect)(code).toMatch(/^\d{6}$/);
    });
    (0, vitest_1.it)('withinFence 半径内/外判定', () => {
        // 同一坐标 → 0 米
        (0, vitest_1.expect)(risk.withinFence(30.0, 114.0, 30.0, 114.0, 100)).toBe(true);
        // 约 111km 纬度差 1 度 → 远超 100m
        (0, vitest_1.expect)(risk.withinFence(31.0, 114.0, 30.0, 114.0, 100)).toBe(false);
        // 无目标坐标 → 放行
        (0, vitest_1.expect)(risk.withinFence(30.0, 114.0, 0, 0, 100)).toBe(true);
    });
});
//# sourceMappingURL=jianghu.service.spec.js.map