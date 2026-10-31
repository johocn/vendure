"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAdvisoryLock = withAdvisoryLock;
const core_1 = require("@vendure/core");
/**
 * 在 PG 会话级咨询锁内执行 fn（与 ops-check / dispatch-job 等既有任务同模式）。
 *
 * - 拿不到锁说明其他实例正在执行，直接返回 undefined，调用方应跳过本轮；
 * - fn 抛错时异常向上抛出（由 PeriodicFallback 隔离），unlock / release 均在 finally 中完成；
 * - 本地 sqlite 不支持 advisory lock：锁查询失败时记 warn 并直接执行 fn，保证单进程开发可用
 *   （现有任务均未做 sqlite 兼容，这里保持同一口径）。
 */
async function withAdvisoryLock(connection, key, fn, loggerCtx = 'CampusJob') {
    var _a, _b;
    const runner = connection.rawConnection.createQueryRunner();
    await runner.connect();
    try {
        let got;
        try {
            got = await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [key]);
        }
        catch (e) {
            // sqlite 等无 advisory lock 的环境：降级为直接执行（跨实例互斥仅在 PG 生效）
            core_1.Logger.warn(`advisory lock 不可用，降级直接执行：${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)}`, loggerCtx);
            return await fn();
        }
        const rows = Array.isArray(got) && Array.isArray(got[0]) ? got[0] : got;
        if (!((_b = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _b === void 0 ? void 0 : _b.ok))
            return undefined;
        try {
            return await fn();
        }
        finally {
            await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined);
        }
    }
    finally {
        await runner.release();
    }
}
//# sourceMappingURL=advisory-lock.js.map